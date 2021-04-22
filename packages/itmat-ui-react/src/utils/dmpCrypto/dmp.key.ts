import * as Utils from './dmp.utils';
import { ErrorMessage, ErrorCodes } from './dmp.constant';
import crypto from './dmp.crypto';

const CURRENT_KEY_VERSION = 2;

export type ClearKeyPair = {
    publicKey: JsonWebKey; // need to use raw (pkcs8) as soon as firefox fixes bug 1133698
    privateKey: JsonWebKey; // need to use raw (pkcs8) as soon as firefox fixes bug 1133698
    version: number;
}

type EncryptedKeyPairV0 = {
    version: string;
    name?: string;
    iv: string;
    salt: string;
    encryptedKeys?: string;
    encryptedKeyPair?: string;
}

type EncryptedKeyPairV2 = {
    version: number;
    name?: string;
    iv: string;
    salt: string;
    data: string;
}

export type EncryptedKeyPair = EncryptedKeyPairV0 | EncryptedKeyPairV2;

export class Key {

    private _cryptoKeyPair: CryptoKeyPair;
    private _exportableKey?: ClearKeyPair;
    private _exportableEncryptedKey?: EncryptedKeyPairV2;
    private _rawPublicKey?: Uint8Array;
    private constructor(keyPair: CryptoKeyPair, encryptedKeyPair?: EncryptedKeyPairV2) {
        this._cryptoKeyPair = keyPair;
        this._exportableEncryptedKey = encryptedKeyPair;
    }

    getCryptoKeyPair(): CryptoKeyPair {
        return this._cryptoKeyPair;
    }

    async seal(pwd: string): Promise<Key> {

        if (!this._cryptoKeyPair)
            throw new Error(ErrorMessage[ErrorCodes.EKEYISENC]);

        const salt = Utils.getRandomBytes(32);
        const iv = Utils.getRandomBytes(12);
        const weakPwd = Utils.encode(pwd);
        const strongPwd = await Utils.hash(Utils.concatBytes(salt, weakPwd));
        const key = await crypto.subtle.importKey('raw', strongPwd, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
        const keyPair = await this.exportKey();
        const data = Utils.encode(JSON.stringify({
            publicKey: keyPair.publicKey,
            privateKey: keyPair.privateKey
        }));
        const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv, tagLength: 128 }, key, data));

        this._exportableEncryptedKey = {
            version: CURRENT_KEY_VERSION,
            iv: Utils.toBase64(iv),
            salt: Utils.toBase64(salt),
            data: Utils.toBase64(encrypted)
        };

        return this;
    }

    async exportKey(): Promise<ClearKeyPair> {
        if (!this._exportableKey)
            this._exportableKey = {
                version: CURRENT_KEY_VERSION,
                publicKey: await crypto.subtle.exportKey('jwk', this._cryptoKeyPair.publicKey),
                privateKey: await crypto.subtle.exportKey('jwk', this._cryptoKeyPair.privateKey)
            };
        return this._exportableKey;
    }

    async exportEncryptedKey(): Promise<EncryptedKeyPairV2> {
        if (!this._exportableEncryptedKey)
            throw new Error(ErrorMessage[ErrorCodes.EKEYNOTSL]);
        return this._exportableEncryptedKey;
    }

    async getRawPublicKey(): Promise<Uint8Array> {
        if (!this._rawPublicKey)
            this._rawPublicKey = new Uint8Array(await crypto.subtle.exportKey('raw', this._cryptoKeyPair.publicKey)).subarray(1);
        return this._rawPublicKey;
    }

    async getRawPublicKeyHex(delimiter = ''): Promise<string> {
        return Utils.toHex(await this.getRawPublicKey(), delimiter);
    }

    static async createKey(): Promise<Key> {
        return new Key(await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']));
    }

    static async createRSAKey(): Promise<CryptoKeyPair> {
        return await crypto.subtle.generateKey({
            name: 'RSASSA-PKCS1-v1_5',
            modulusLength: 4096,
            publicExponent: new Uint8Array([1, 0, 1]),
            hash: 'SHA-256'
        },
        true,
        ['verify', 'sign']
        );
    }

    static async exportRSAKey(keyPair: CryptoKeyPair) {
        const publicKey = await crypto.subtle.exportKey('spki', keyPair.publicKey);
        const privateKey = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);
        return {privateKey: Utils.convertBinaryToPem(privateKey, 'ENCRYPTED PRIVATE KEY'), publicKey: Utils.convertBinaryToPem(publicKey, 'PUBLIC KEY')};
    }

    static async signwtRSAKey(key: CryptoKeyPair) {
        const publicKeyEncoded = Utils.toSupportedArray(key.publicKey);
        const encoded = await Utils.hash(publicKeyEncoded);
        const signature = await crypto.subtle.sign(
            'RSASSA-PKCS1-V1_5',
            key.privateKey,
            encoded
        );
        return Utils.arrayBufferToBase64String(signature);
    }

    static async importKey(exportableKey: ClearKeyPair): Promise<Key> {

        const publicKey = await crypto.subtle.importKey('jwk', exportableKey.publicKey, { name: 'ECDSA', namedCurve: 'P-256' }, true, ['verify']);
        const privateKey = await crypto.subtle.importKey('jwk', exportableKey.privateKey, { name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign']);

        return new Key({
            publicKey,
            privateKey
        });
    }

    static async importEncryptedKeyPair(inputEncryptedKeyPair: EncryptedKeyPair, pwd: string): Promise<Key> {

        const decryptV2 = async (inputKeyPair: Pick<EncryptedKeyPairV2, 'iv' | 'salt' | 'data'>) => {

            const iv = Utils.fromBase64(inputKeyPair.iv);
            const salt = Utils.fromBase64(inputKeyPair.salt);
            const encrypted = Utils.fromBase64(inputKeyPair.data);
            const weakpwd = Utils.encode(pwd);
            const strongPwd = await Utils.hash(Utils.concatBytes(salt, weakpwd));
            const aesKey = await crypto.subtle.importKey('raw', strongPwd, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);

            let decrypted: Uint8Array;
            try {
                decrypted = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv, tagLength: 128 }, aesKey, encrypted));
            }
            catch (e) {
                throw new Error(ErrorMessage[ErrorCodes.EINPASSWD]);
            }

            return decrypted;
        };

        switch (parseInt(`${inputEncryptedKeyPair.version ?? 0}`)) {
            case 0:
            case 1: {
                const encryptedKey = inputEncryptedKeyPair as EncryptedKeyPairV0;
                const decrypted = await decryptV2({
                    iv: encryptedKey.iv,
                    salt: encryptedKey.salt,
                    data: encryptedKey.encryptedKeys ?? encryptedKey.encryptedKeyPair ?? ''
                });

                const publicKey = await crypto.subtle.importKey('raw', decrypted.subarray(0, 65), { name: 'ECDSA', namedCurve: 'P-256' }, true, ['verify']);
                const privateKey = await crypto.subtle.importKey('pkcs8', decrypted.subarray(65), { name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign']);
                const newKey = new Key({
                    publicKey,
                    privateKey
                });

                return await newKey.seal(pwd);
            }
            case 2: {
                const encryptedKey = inputEncryptedKeyPair as EncryptedKeyPairV2;
                const decrypted = await decryptV2(encryptedKey);
                const obj = JSON.parse(Utils.decode(decrypted));
                const publicKey = await crypto.subtle.importKey('jwk', obj.publicKey, { name: 'ECDSA', namedCurve: 'P-256' }, true, ['verify']);
                const privateKey = await crypto.subtle.importKey('jwk', obj.privateKey, { name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign']);

                return new Key({
                    publicKey,
                    privateKey
                }, encryptedKey);
            }
            default:
                throw new Error(ErrorMessage[ErrorCodes.EINVKFORM]);
        }
    }
}
