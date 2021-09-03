export interface IStudy {
    id: string;
    name: string;
    createdBy: string;
    lastModified: number;
    deleted: number | null;
    currentDataVersion: number; // index; dataVersions[currentDataVersion] gives current version; // -1 if no data
    dataVersions: IStudyDataVersion[];
}

export interface IStudyDataVersion {
    id: string; // uuid
    contentId: string; // same contentId = same data
    version: string;
    tag?: string;
    fileSize: string;
    uploadDate: string;
    jobId: string;
    extractedFrom: string;
    fieldTrees: string[];
}


export interface IRole {
    id: string;
    projectId?: string;
    studyId: string;
    name: string;
    permissions: string[];
    users: string[];
    createdBy: string;
    deleted: number | null;
}

export interface IProject {
    id: string;
    studyId: string;
    createdBy: string;
    name: string;
    patientMapping: { [originalId: string]: string };
    approvedFields: { [fieldTreeId: string]: string[] };
    approvedFiles: string[];
    lastModified: number;
    deleted: number | null;
}
