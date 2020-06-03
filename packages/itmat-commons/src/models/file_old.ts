export interface IFile<T = undefined> {
    id: string;
    fileName: string;
    studyId?: string;
    projectId?: string;
    fileSize?: number;
    fileType: fileType;
    // if this is a zip file -> isZipped == true -> unzip -> isZipped == false; if not a zip file, then just false
    // only fileType of DIR can be zipped
    isZipped?: boolean;
    fromZippedFileId?: string; // fileId of original zipped file from which this file is extracted, if applicable
    description?: string;
    uploadedBy: string;  // userId
    uri?: string;
    deleted: number | null;
    extraData: T
}

export enum fileType {
    STUDY_REPO_FILE = 'STUDY_REPO_FILE',
    STUDY_REPO_DIR = 'STUDY_REPO_DIR',
    PATIENT_DATA_BLOB_DIR = 'PATIENT_DATA_BLOB_DIR',
    PATIENT_DATA_BLOB_FILE = 'PATIENT_DATA_BLOB_FILE',
    USER_PERSONAL_FILE = 'USER_PERSONAL_FILE ',
    USER_PERSONAL_DIR = 'USER_PERSONAL_DIR'
}

// all users will have a root USER_PERSONAL_DIR that includes all their files and dir.
// Therefore, there should be no orphan personal file (file that do not belong to any dir)
// 'userId' is not needed for constructing the tree, because the user's files are traced recursively from root dir
// but it can be handy for actions like 'deleting all files belonging to xxx user
export type IFileForStudyRepoFile = IFile;
export type IFileForStudyRepoDir = IFile<{ childFileIds: string[] }>;
export type IFileForUserPersonalFile = IFile<{ userId: string }>;
export type IFileForUserPersonalDir = IFile<{ userId: string, childFileIds: string[]}>;
export type IFileForPatientDataBlobDir = IFile<{ childFileIds: string[] }>;
export type IFileForPatientDataBlobFile = IFile<{ patientId?: string }>;  // patientId present after patient curation
