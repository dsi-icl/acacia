export enum userTypes {
    ADMIN = 'ADMIN',
    STANDARD = 'STANDARD'
}

export interface IUserWithoutToken {
    id: string;
    username: string;
    email: string;
    realName: string;
    organisation: string;
    type: userTypes;
    description: string;
    emailNotificationsActivated: boolean;
    deleted: number | null;
    rootDir: string; // file id
    createdBy: string;
    resetPasswordRequests: IResetPasswordRequest[]
}

export interface IResetPasswordRequest {
    id: string;
    timeOfRequest: number;
    used: boolean;
}

export interface IUser extends IUserWithoutToken {
    password: string;
}
