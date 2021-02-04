export interface IPubkey {
    id: string;
    pubkey: string;
    jwtPubkey: string;
    jwtSeckey: string;
    refreshCounter: number;
    associatedUserId: string | null;
    deleted: number | null;
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
