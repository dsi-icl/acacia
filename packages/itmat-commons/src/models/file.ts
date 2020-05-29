export interface IFile<T = undefined> {
    id: string;
    fileName: string;
    studyId: string;
    projectId?: string;
    fileSize?: number;
    description: string;
    uploadedBy: string;  // userId
    uri: string;
    deleted: number | null;
    extraData: T
}

export enum fileType {
    STUDY_REPO_FILE = 'STUDY_REPO_FILE',
    PATIENT_DATA_BLOB = 'PATIENT_DATA_BLOB',
    USER_PERSONAL_FILE = 'USER_PERSONAL_FILE ',
    USER_PERSONAL_DIR = 'USER_PERSONAL_DIR'
}

// all users will have a root USER_PERSONAL_DIR that includes all their files and dir.
// Therefore, there should be no orphan personal file (file that do not belong to any dir)
// 'userId' is not needed for constructing the tree, because the user's files are traced recursively from root dir
// but it can be handy for actions like 'deleting all files belonging to xxx user
type IFileForUserPersonalFile = IFile<{ userId: string }>;
type IFileForUserPersonalDirectory = IFile<{ userId: string, childFileIds: string[]}>;
