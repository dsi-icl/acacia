export interface IStudy {
    id: string,
    name: string,
    isUkbiobank: boolean,
    roles: IRole[],
    createdBy: string,
    lastModified: number,
    deleted: false
}

export interface IRole {
    name: string,
    permissions: string[],
    users: string[]
}

export interface IProject {
    id: string,
    study: string,
    name: string,
    roles: IRole[],
    patientMapping: { [originalId: string]: string },
    approvedFields: string[]
}