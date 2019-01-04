export interface IStudy {
    name: string,
    studyAndDataManagers: string[],
    applications: IApplication[],
    createdBy: string,
    lastModified: number,
    deleted: false
}

export interface IApplication {
    name: string,
    pendingUserApprovals: {
        user: string,
        type: APPLICATION_USER_TYPE
    }[],
    applicationAdmins: string[],
    applicationUsers: string[],
    approvedFields: string[]
}

export const enum APPLICATION_USER_TYPE {
    applicationAdmin = 'APPLICATION_ADMIN',
    applicationUser = 'APPLICATION_USER'
}