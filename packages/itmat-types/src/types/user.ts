import { IBase } from './base';

export enum enumUserTypes {
    ADMIN = 'ADMIN',
    STANDARD = 'STANDARD',
    SYSTEM = 'SYSTEM',
    GUEST = 'GUEST'
}

export enum enumReservedUsers {
    SYSTEM = 'SYSTEM'
}

export interface IUserWithoutToken extends IBase {
    username: string;
    email: string;
    firstname: string;
    lastname: string;
    organisation: string;
    type: enumUserTypes;
    emailNotificationsActivated: boolean;
    emailNotificationsStatus: {
        expiringNotification: boolean
    };
    resetPasswordRequests: IResetPasswordRequest[];
    profile?: string;
    expiredAt: number;
    description?: string;
}

export interface IResetPasswordRequest {
    id: string;
    timeOfRequest: number;
    used: boolean;
}

export interface IUser extends IUserWithoutToken {
    password: string;
    otpSecret: string;
}
