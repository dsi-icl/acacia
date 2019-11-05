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
    createdBy: string;
}

export interface IUser extends IUserWithoutToken {
    password: string;
}
