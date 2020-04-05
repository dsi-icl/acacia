export interface IFile {
    id: string;
    fileName: string;
    studyId: string;
    projectId?: string;
    fileSize?: number;
    description: string;
    uploadedBy: string;  // userId
    uri: string;
    deleted: number | null;
}
