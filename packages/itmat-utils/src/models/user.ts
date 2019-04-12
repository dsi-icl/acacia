export enum userTypes {
    ADMIN = 'ADMIN',
    STANDARD = 'STANDARD'
}

export interface INotification {
    timestamp: number,
    comment: string,
    read: boolean
}

export interface IShortCut {
    id: string,
    study: string,
    project?: string
}

export interface IUserWithoutToken {
    id: string,
    username: string,
    email: string,
    realName: string,
    shortcuts: IShortCut[],
    type: userTypes,
    description: string,
    notifications: INotification[],
    emailNotificationsActivated: boolean,
    deleted: boolean,
    createdBy: string
}

export interface IUser extends IUserWithoutToken {
    password: string
}
