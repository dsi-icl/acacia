export enum userTypes {
    ADMIN = 'ADMIN',
    STANDARD = 'STANDARD'
}

export interface IUserWithoutToken {
    id: string,
    username: string,
    email: string,
    realName: string,
    type: userTypes,
    description: string,
    emailNotificationsActivated: boolean,
    deleted: boolean,
    createdBy: string
}

export interface IUser extends IUserWithoutToken {
    password: string
}
