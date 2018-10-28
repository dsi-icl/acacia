import mongodb from 'mongodb';

export enum userTypes {
    ADMIN = 'ADMIN',
    STANDARD = 'STANDARD'
}

export interface IUserWithoutToken {
    _id?: mongodb.ObjectId,
    username: string,
    type: keyof typeof userTypes,
    deleted?: boolean,
    createdBy: string
}

export interface IUser extends IUserWithoutToken {
    password: string
}


