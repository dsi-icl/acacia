export interface IStudy {
    id: string,
    name: string,
    isUkbiobank: boolean,
    studyAndDataManagers: string[],
    applications: IApplication[],
    createdBy: string,
    lastModified: number,
    deleted: false
}

export interface IApplication {
    id: string,
    study: string,
    name: string,
    pendingUserApprovals: IPendingApproval[],
    applicationAdmins: string[],
    applicationUsers: string[],
    approvedFields: string[]
}

export enum APPLICATION_USER_TYPE {
    applicationAdmin = 'APPLICATION_ADMIN',
    applicationUser = 'APPLICATION_USER'
}

export interface IPendingApproval {
    id: string,
    user: string,
    type: APPLICATION_USER_TYPE
}