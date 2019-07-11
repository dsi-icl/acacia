export interface IStudy {
    id: string,
    name: string,
    createdBy: string,
    lastModified: number,
    deleted: boolean,
    currentDatasetId?: string, // generated id
    currentDatasetVersion?: string, // user provided
    currentDatasetTag?: string, // user provided
    currentDataIsUploadedOn?: number,
    currentDataIsExtractedFrom?: string, // file name
    pastDataVersions: {
        id: string,
        version: string,
        tag: string,
        uploadDate: number,
        extractedFrom: string
    }[]
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
    approvedFiles: string[],
    lastModified: number,
    deleted: boolean
}
