import { IBase } from './base';

export interface IPubkey extends IBase {
    pubkey: string;
    hashedPrivateKey?: string;
    jwtPubkey: string;
    jwtSeckey: string;
    refreshCounter: number;
    associatedUserId: string | null;
    challenge: string | null;
    lastUsedTime: number | null;
}

export type AccessToken = {
    accessToken?: string;
}

export type KeyPairwSignature = {
    privateKey: string;
    publicKey: string;
    signature?: string;
}

export type Signature = {
    signature: string;
}
