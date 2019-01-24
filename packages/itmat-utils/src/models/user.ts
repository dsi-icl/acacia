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

// export interface IShortCut {
//     id: string,
//     name: string,
//     url: string
// }

export interface IUserWithoutToken {
    _id?: mongodb.ObjectId,
    id: string,
    username: string,
    email: string,
    realName: string,
    // shortcuts: IShortCut[],
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
