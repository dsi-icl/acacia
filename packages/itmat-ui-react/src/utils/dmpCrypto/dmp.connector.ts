import * as NNG from './nng.websocket';
import * as Utils from './dmp.utils';
import { Key } from './dmp.key';
import { ErrorCodes, Secrets, ConnectionState, ErrorMessage } from './dmp.constant';
import crypto from './dmp.crypto';

class SCPSession {
    iv: Uint8Array;
    cryptoKey: CryptoKey;

    constructor(iv: Uint8Array, cryptoKey: CryptoKey) {
        this.iv = iv;
        this.cryptoKey = cryptoKey;
    }
}

type ErrorHandler = (error: string, requestId: string) => void;
type ResultHandler = (result: Record<string, unknown> | string | void, requestId: string) => void;
type NaiveHandler = (requestId: string) => void;

interface QueryHandlers {
    onError: (handler: ErrorHandler) => this;
    onResult: (handler: ResultHandler) => this;
}

interface TransactionHandlers extends QueryHandlers {
    onAcknowledged: (handler: NaiveHandler) => this;
    onProposed: (handler: NaiveHandler) => this;
    onCommitted: (handler: NaiveHandler) => this;
    onExecuted: (handler: NaiveHandler) => this;
}

interface NotificationHandlers {
    failed?: boolean;
    promise: {
        resolve: (o: Record<string, unknown> | string | void) => void;
        reject: (o: string) => void
    };
}

type QueryNotificationHandlers = NotificationHandlers & {
    onError: ErrorHandler[];
    onResult: ResultHandler[];
};

type TransactionNotificationHandlers = QueryNotificationHandlers & {
    onAcknowledged: NaiveHandler[];
    onProposed: NaiveHandler[];
    onCommitted: NaiveHandler[];
    onExecuted: NaiveHandler[];
}

export type Query = QueryHandlers & {
    send?: () => Promise<Record<string, unknown> | string | void>;
}

export type Transaction = TransactionHandlers & {
    send?: () => Promise<Record<string, unknown> | string | void>;
}

export class SCP {

    private _socket: NNG.WS | null = null;
    private _connectionState = ConnectionState.closed;
    private _onStateChange: ((state: ConnectionState) => void) | null = null;
    private _onError?: ((err: string) => void) | null = null;
    private _requests: { [key: string]: (QueryNotificationHandlers | TransactionNotificationHandlers) } = {};
    private _session: SCPSession | null = null;

    constructor() {
        this.reset();
    }

    reset(): SCP {
        if (this._socket && this._socket.state > NNG.State.closing)
            this._socket.close();

        this._session = null;
        this._onStateChange = null;
        this._onError = null;
        this._requests = {};
        this._updateState(3);
        return this;
    }

    private _updateState(state: ConnectionState): void {
        this._connectionState = state;
        if (this._onStateChange !== null)
            this._onStateChange(state);
    }

    private async _encrypt(data: Uint8Array): Promise<Uint8Array> {
        if (!this._session)
            throw new Error(ErrorMessage[ErrorCodes.ESCPNOTRD]);
        const ivOffset = Utils.getRandomBytes(16);
        const iv = Utils.incrementBy(this._session.iv, ivOffset).subarray(0, 12);
        const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv, tagLength: 128 },
            this._session.cryptoKey, data));
        return Utils.concatBytes(ivOffset, encrypted);
    }

    private async _decrypt(data: Uint8Array): Promise<Uint8Array> {
        if (!this._session)
            throw ErrorCodes.ESCPNOTRD;
        const iv = Utils.incrementBy(this._session.iv, data.subarray(0, 16)).subarray(0, 12);
        return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv, tagLength: 128 },
            this._session.cryptoKey, data.subarray(16)));
    }

    private _notify(json: string): void {
        try {
            const o = JSON.parse(json);
            if (process.env.NODE_ENV === 'development' || process.env.REACT_APP_CFA_PRODUCTION_LOGGING === 'true')
                console.debug('Secretarium received:', o);
            if (o !== null && o.requestId) {
                const x = this._requests[o.requestId];
                if (!x) {
                    console.debug('Unexpected notification: ' + json);
                    return;
                }
                if (o.error) {
                    x.onError?.forEach(cb => cb(o.error, o.requestId));
                    x.failed = true;
                    x.promise.reject(o.error);
                }
                else if (o.result) {
                    x.onResult?.forEach(cb => cb(o.result, o.requestId));
                    x.promise.resolve(o.result);
                }
                else if (o.state) {
                    if (x.failed === true)
                        return;
                    const z = x as TransactionNotificationHandlers;
                    switch (o.state.toLowerCase()) {
                        case 'acknowledged': z.onAcknowledged?.forEach(cb => cb(o.requestId)); break;
                        case 'proposed': z.onProposed?.forEach(cb => cb(o.requestId)); break;
                        case 'committed': z.onCommitted?.forEach(cb => cb(o.requestId)); break;
                        case 'executed':
                            z.onExecuted?.forEach(cb => cb(o.requestId));
                            z.promise.resolve(o.result);
                            break;
                        case 'failed':
                            z.onError?.forEach(cb => cb(ErrorMessage[ErrorCodes.ETRANSFIL], o.requestId));
                            z.failed = true;
                            z.promise.reject(o.error);
                            break;
                        default: break;
                    }
                }
            }
        }
        catch (e) {
            const m = `Error '${e.message}' when received '${JSON.stringify(json)}'`;
            if (this._onError)
                this._onError(m);
            else
                console.error(m);
        }
    }

    private _computeProofOfWork(nonce: Uint8Array): Uint8Array {
        return nonce; // proof-of-work verification is currently deactivated
    }

    get state() {
        return this._connectionState;
    }

    get bufferedAmount() {
        return this._socket?.bufferedAmount || 0;
    }

    connect(url: string, userKey: Key, knownTrustedKey: Uint8Array | string, protocol: NNG.Protocol = NNG.Protocol.pair1): Promise<void> {
        if (this._socket && this._socket.state > NNG.State.closing)
            this._socket.close();

        this._updateState(ConnectionState.connecting);
        const trustedKey = typeof knownTrustedKey === 'string' ? Uint8Array.from(Utils.fromBase64(knownTrustedKey, true)) : knownTrustedKey;
        const socket = this._socket = new NNG.WS();
        let ecdh: CryptoKeyPair;
        let ecdhPubKeyRaw: Uint8Array;
        let serverEcdsaPubKey: CryptoKey;

        return new Promise((resolve, reject) => {
            new Promise((resolve, reject) => {
                const tId = setTimeout(() => { reject(ErrorMessage[ErrorCodes.ETIMOCHEL]); }, 3000);
                socket
                    .onopen(x => { clearTimeout(tId); resolve(x); })
                    .onerror(reject)
                    .onclose(reject)
                    .connect(url, protocol);
            })
                .then(async (): Promise<Uint8Array> => {
                    socket
                        .onerror(() => { this._updateState(ConnectionState.closed); })
                        .onclose(() => { this._updateState(ConnectionState.closed); });

                    ecdh = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
                    ecdhPubKeyRaw = new Uint8Array(await crypto.subtle.exportKey('raw', ecdh.publicKey)).subarray(1);
                    return new Promise((resolve, reject) => {
                        const tId = setTimeout(() => { reject(ErrorMessage[ErrorCodes.ETIMOCHEL]); }, 3000);
                        socket.onmessage(x => { clearTimeout(tId); resolve(x); }).send(ecdhPubKeyRaw);
                    });
                })
                .then((serverHello: Uint8Array): Promise<Uint8Array> => {
                    const pow = this._computeProofOfWork(serverHello.subarray(0, 32));
                    const clientProofOfWork = Utils.concatBytesArrays([pow, trustedKey]);
                    return new Promise((resolve, reject) => {
                        const tId = setTimeout(() => { reject(ErrorMessage[ErrorCodes.ETIMOCPOW]); }, 3000);
                        socket.onmessage(x => { clearTimeout(tId); resolve(x); }).send(clientProofOfWork);
                    });
                })
                .then(async (serverIdentity: Uint8Array): Promise<Uint8Array> => {
                    const preMasterSecret = serverIdentity.subarray(0, 32);
                    const serverEcdhPubKey = await crypto.subtle.importKey('raw',
                        Utils.concatBytes(/*uncompressed*/Uint8Array.from([4]), serverIdentity.subarray(32, 96)),
                        { name: 'ECDH', namedCurve: 'P-256' }, false, []);
                    serverEcdsaPubKey = await crypto.subtle.importKey('raw',
                        Utils.concatBytes(/*uncompressed*/Uint8Array.from([4]), serverIdentity.subarray(serverIdentity.length - 64)),
                        { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);

                    // Check inheritance from Secretarium knownTrustedKey
                    const knownTrustedKeyPath = serverIdentity.subarray(96);
                    if (knownTrustedKeyPath.length === 64) {
                        if (!Utils.sequenceEqual(trustedKey, knownTrustedKeyPath))
                            throw new Error(ErrorMessage[ErrorCodes.ETINSRVID]);
                    }
                    else {
                        for (let i = 0; i < knownTrustedKeyPath.length - 64; i = i + 128) {
                            const key = knownTrustedKeyPath.subarray(i, 64);
                            const proof = knownTrustedKeyPath.subarray(i + 64, 64);
                            const keyChild = knownTrustedKeyPath.subarray(i + 128, 64);
                            const ecdsaKey = await crypto.subtle.importKey('raw',
                                Utils.concatBytes(/*uncompressed*/Uint8Array.from([4]), key),
                                { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
                            if (!await crypto.subtle.verify({ name: 'ECDSA', hash: { name: 'SHA-256' } }, ecdsaKey, proof, keyChild))
                                throw new Error(`${ErrorMessage[ErrorCodes.ETINSRVIC]}${i}`);
                        }
                    }

                    const commonSecret = await crypto.subtle.deriveBits(
                        { name: 'ECDH', public: serverEcdhPubKey }, ecdh.privateKey, 256);
                    const sha256Common = new Uint8Array(await crypto.subtle.digest({ name: 'SHA-256' }, commonSecret));
                    const symmetricKey = Utils.xor(preMasterSecret, sha256Common);
                    const iv = symmetricKey.subarray(16);
                    const key = symmetricKey.subarray(0, 16);
                    const cryptoKey = await crypto.subtle.importKey('raw', key, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
                    this._session = new SCPSession(iv, cryptoKey);

                    const cryptoKeyPair = userKey.getCryptoKeyPair();
                    const publicKeyRaw = await userKey.getRawPublicKey();
                    if (!userKey || !cryptoKeyPair || !publicKeyRaw)
                        throw new Error(ErrorMessage[ErrorCodes.ETINUSRKY]);

                    const nonce = Utils.getRandomBytes(32);
                    const signedNonce = new Uint8Array(await crypto.subtle.sign(
                        { name: 'ECDSA', hash: { name: 'SHA-256' } }, cryptoKeyPair.privateKey, nonce));
                    const clientProofOfIdentity = Utils.concatBytesArrays(
                        [nonce, ecdhPubKeyRaw, publicKeyRaw, signedNonce]);

                    const encryptedClientProofOfIdentity = await this._encrypt(clientProofOfIdentity);
                    return new Promise((resolve, reject) => {
                        const tId = setTimeout(() => { reject(ErrorMessage[ErrorCodes.ETIMOCPOI]); }, 3000);
                        socket.onmessage(x => { clearTimeout(tId); resolve(x); }).send(encryptedClientProofOfIdentity);
                    });
                })
                .then(async (serverProofOfIdentityEncrypted: Uint8Array): Promise<void> => {
                    const serverProofOfIdentity = await this._decrypt(serverProofOfIdentityEncrypted);
                    const welcome = Utils.encode(Secrets.SRTWELCOME);
                    const toVerify = Utils.concatBytes(serverProofOfIdentity.subarray(0, 32), welcome);
                    const serverSignedHash = serverProofOfIdentity.subarray(32, 96);
                    const check = await crypto.subtle.verify({ name: 'ECDSA', hash: { name: 'SHA-256' } },
                        serverEcdsaPubKey, serverSignedHash, toVerify);
                    if (!check)
                        throw new Error(ErrorMessage[ErrorCodes.ETINSRVPI]);

                    socket.onmessage(async encrypted => {
                        const data = await this._decrypt(encrypted);
                        const json = Utils.decode(data);
                        this._notify(json);
                    });

                    this._updateState(1);
                    resolve();
                })
                .catch((e: Error) => {
                    this._updateState(2);
                    socket.close();
                    this._updateState(3);
                    reject(`${ErrorMessage[ErrorCodes.EUNABLCON]}${(e as any).type ?? e.message ?? e.toString()}`);
                });
        });
    }

    onError(handler: (err: string) => void): SCP {
        this._onError = handler;
        return this;
    }

    onStateChange(handler: (state: ConnectionState) => void): SCP {
        this._onStateChange = handler;
        return this;
    }

    newQuery(app: string, command: string, requestId: string, args: Record<string, unknown> | string): Query {
        let cbs: Partial<QueryNotificationHandlers> = {};
        const pm = new Promise<Record<string, unknown> | string | void>((resolve, reject) => {
            this._requests[requestId] = cbs = {
                onError: [],
                onResult: [],
                promise: {
                    resolve,
                    reject
                }
            };
        });
        const query: Query = {
            onError: x => { (cbs.onError = cbs.onError || []).push(x); return query; },
            onResult: x => { (cbs.onResult = cbs.onResult || []).push(x); return query; },
            send: () => { this.send(app, command, requestId, args); return pm; }
        };
        return query;
    }

    newTx(app: string, command: string, requestId: string, args: Record<string, unknown> | string): Transaction {
        let cbs: TransactionNotificationHandlers;
        const pm = new Promise<Record<string, unknown> | string | void>((resolve, reject) => {
            this._requests[requestId] = cbs = {
                onError: [],
                onResult: [],
                onAcknowledged: [],
                onCommitted: [],
                onExecuted: [],
                onProposed: [],
                promise: {
                    resolve,
                    reject
                }
            };
        });
        const tx: Transaction = {
            onError: x => { (cbs.onError = cbs.onError || []).push(x); return tx; },
            onAcknowledged: x => { (cbs.onAcknowledged = cbs.onAcknowledged || []).push(x); return tx; },
            onProposed: x => { (cbs.onProposed = cbs.onProposed || []).push(x); return tx; },
            onCommitted: x => { (cbs.onCommitted = cbs.onCommitted || []).push(x); return tx; },
            onExecuted: x => { (cbs.onExecuted = cbs.onExecuted || []).push(x); return tx; },
            onResult: x => { (cbs.onResult = cbs.onResult || []).push(x); return tx; }, // for chained tx + query
            send: () => { this.send(app, command, requestId, args); return pm; }
        };
        return tx;
    }

    async send(app: string, command: string, requestId: string, args: Record<string, unknown> | string): Promise<void> {
        if (!this._socket || !this._session || this._socket.state !== NNG.State.open) {
            const z = this._requests[requestId]?.onError;
            if (z) {
                z.forEach(cb => cb(ErrorMessage[ErrorCodes.ENOTCONNT], requestId));
                return;
            }
            else throw new Error(ErrorMessage[ErrorCodes.ENOTCONNT]);
        }

        const query = JSON.stringify({
            dcapp: app,
            function: command,
            requestId: requestId,
            args: args
        });
        const data = Utils.encode(query);
        const encrypted = await this._encrypt(data);

        if (app !== '__local__') {

            if (process.env.NODE_ENV === 'development' || process.env.REACT_APP_CFA_PRODUCTION_LOGGING === 'true')
                console.debug('DMP sending:', JSON.parse(query));

            this._socket.send(encrypted);
        }
    }

    close(): SCP {
        if (this._socket)
            this._socket.close();
        return this;
    }
}
