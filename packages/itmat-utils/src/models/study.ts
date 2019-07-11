export interface IStudy {
    id: string,
    name: string,
    createdBy: string,
    lastModified: number,
    deleted: boolean,
    currentDataVersion: number, // index; dataVersions[currentDataVersion] gives current version; // -1 if no data
    dataVersions: {
        id: string,
        version: string,
        tag?: string,
        fileSize: number,
        uploadDate: number,
        jobId: string,
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
