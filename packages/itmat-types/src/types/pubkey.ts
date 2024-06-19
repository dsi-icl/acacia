import { IBase } from './base';

export interface IPubkey extends IBase {
    pubkey: string;
    jwtPubkey: string;
    jwtSeckey: string;
    refreshCounter: number;
    associatedUserId: string | null;
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
