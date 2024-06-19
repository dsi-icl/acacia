export interface ILifeCircle {
    createdTime: number;
    createdUser: string;
    deletedTime: number | null;
    deletedUser: string | null;
}

export interface IBase {
    id: string;
    life: ILifeCircle;
    metadata: Record<string, unknown>;
}