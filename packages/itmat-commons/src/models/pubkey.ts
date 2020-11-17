export interface IPubkey {
    id: string;
    pubkey: string;
    jwtSecret: string;
    refreshCounter: number;
    associatedUserId: string | null;
    deleted: number | null;
}
