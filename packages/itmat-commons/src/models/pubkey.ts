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