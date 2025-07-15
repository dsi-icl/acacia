import { Readable } from 'stream';
import { IBase } from './base';

export interface IFile extends IBase {
    studyId: string | null; // null for system and user file
    userId: string | null; // null for system and study file
    fileName: string;
    fileSize: number;
    description?: string;
    properties: Record<string, unknown>;
    uri: string;
    hash: string;
    fileType: enumFileTypes;
    fileCategory: enumFileCategories;
    sharedUsers?: string[];
}



export enum enumFileTypes {
    CSV = 'CSV',
    ZIP = 'ZIP',
    RAR = 'RAR',
    UNKNOWN = 'UNKNOWN',
    MARKDOWN = 'MARKDOWN',
    TXT = 'TXT',
    JSON = 'JSON',
    PDF = 'PDF',
    DOCX = 'DOCX',
    XLSX = 'XLSX',
    XLS = 'XLS',
    MAT = 'MAT',
    // images
    JPG = 'JPG',
    JPEG = 'JPEG',
    PNG = 'PNG',
    WEBP = 'WEBP',
    GIF = 'GIF',
    // videos
    MP4 = 'MP4',
    AVI = 'AVI',
    // others
    FEATHER = 'FEATHER'
}

export enum enumFileCategories {
    STUDY_DATA_FILE = 'STUDY_DATA_FILE',
    USER_DRIVE_FILE = 'USER_REPO_FILE',
    DOC_FILE = 'DOC_FILE',
    CACHE = 'CACHE',
    PROFILE_FILE = 'DOMAIN_PROFILE_FILE',
    DOMAIN_FILE = 'DOMAIN_FILE'
}

export interface FileUpload {
    createReadStream: () => Readable;
    filename: string;
    mimetype: string;
    encoding: string;
}
