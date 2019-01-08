import * as mongodb from 'mongodb';

export enum userTypes {
    ADMIN = 'ADMIN',
    STANDARD = 'STANDARD'
}

export interface INotification {
    timestamp: number,
    comment: string,
    read: boolean
}

export interface IUserWithoutToken {
    _id?: mongodb.ObjectId,
    username: string,
    email: string,
    realName: string,
    type: keyof typeof userTypes,
    description: string,
    notifications: INotification[],
    emailNotificationsActivated: boolean,
    deleted?: boolean,
    createdBy: string
}

export interface IUser extends IUserWithoutToken {
    password: string
}
