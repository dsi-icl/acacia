export interface IStudy {
    id: string,
    name: string,
    createdBy: string,
    lastModified: number,
    deleted: boolean
}

export interface IRole {
    id: string
    projectId?: string,
    studyId: string,
    name: string,
    permissions: string[],
    users: string[],
    deleted: boolean
};

export interface IProject {
    id: string,
    studyId: string,
    createdBy: string,
    name: string,
    patientMapping: { [originalId: string]: string },
    approvedFields: string[],
    lastModified: number,
    deleted: boolean
}
