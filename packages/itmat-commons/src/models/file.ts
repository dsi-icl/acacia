interface IFileNode {
    id: string;
    fileName: string;
    fileSize?: number;
    fileType: fileType;
    description?: string;
    uploadedBy: string;  // userId
    deleted: number | null;
}

export interface IDirectory extends IFileNode {
    root: boolean; // if root then can't delete
    childFileIds: string[];
}

interface IScriptFile extends IFileNode {
    content: string;
}

interface IObjStoreFile extends IFileNode {
    uri: string;
}

interface IStudyFile extends IFileNode {
    studyId: string;
}

interface IUserPersonalFile extends IFileNode {
    userId: string;
}

////////////////////////////////////////////////////////////////////////////////////
export interface IFileForUserPersonalFile extends IUserPersonalFile, IFileNode, IScriptFile {}
export interface IFileForUserPersonalDir extends IUserPersonalFile, IDirectory {}
export interface IFileForStudyRepoScriptFile extends IFileNode, IStudyFile, IScriptFile {}
export interface IFileForStudyRepoObjStoreFile extends IFileNode, IStudyFile, IObjStoreFile {}
export interface IFileForStudyRepoDir extends IDirectory, IStudyFile {}
export interface IFileForPatientDataBlobFile extends IFileNode, IStudyFile, IObjStoreFile {
    patientId?: string;
}
export interface IFileForPatientDataBlobDir extends IDirectory, IStudyFile {
    dataVersionId: string;
}

interface _IFileInMongo extends // tslint:disable-line
    IFileNode,
    IDirectory,
    IScriptFile,
    IObjStoreFile,
    IStudyFile,
    IUserPersonalFile,
    IFileForUserPersonalFile,
    IFileForUserPersonalDir,
    IFileForStudyRepoScriptFile,
    IFileForStudyRepoObjStoreFile,
    IFileForStudyRepoDir,
    IFileForPatientDataBlobFile,
    IFileForPatientDataBlobDir {}
export type IFileInMongo = Partial<_IFileInMongo>;

export enum fileType {
    STUDY_REPO_FILE = 'STUDY_REPO_FILE',
    STUDY_REPO_DIR = 'STUDY_REPO_DIR',
    PATIENT_DATA_BLOB_DIR = 'PATIENT_DATA_BLOB_DIR',
    PATIENT_DATA_BLOB_FILE = 'PATIENT_DATA_BLOB_FILE',
    USER_PERSONAL_FILE = 'USER_PERSONAL_FILE ',
    USER_PERSONAL_DIR = 'USER_PERSONAL_DIR'
}

