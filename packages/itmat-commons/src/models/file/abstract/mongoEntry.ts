import { fileTypes } from './fileTypes';
export interface IFileMongoEntry {
    id: string,
    fileName: string,
    studyId?: string,
    projectId?: string,
    fileType: fileTypes,
    fileSize?: number,
    description?: string,
    uploadedBy: string,
    uri?: string,
    content?: string,
    isRoot?: boolean,
    patientId?: string,
    dataVersionId?: string,
    childFileIds?: string[],
    deleted: number | null
}