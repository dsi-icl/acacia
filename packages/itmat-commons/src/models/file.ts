export interface IFile {
    id: string;
    fileName: string;
    studyId: string;
    projectId?: string;
    fileSize?: string;
    description: string;
    uploadTime: string;
    uploadedBy: string;  // userId
    uri: string;
    deleted: number | null;
    hash: string;
}
