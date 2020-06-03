import { FileNode } from './FileNode';
import { fileTypes } from './fileTypes';

export abstract class ObjStoreFileNode extends FileNode {
    private readonly _uri: string;
    private readonly _fileSize: number?;

    constructor(
        id: string | undefined,
        fileName: string,
        fileType: fileTypes,
        uploadedBy: string,
        private description: string
    ) {
        super(id, fileName, fileType, uploadedBy);
        if (![
            fileTypes.STUDY_REPO_FILE,
            fileTypes.PATIENT_DATA_BLOB_FILE
        ].includes(fileType)) {
            throw new Error(`Cannot instantiate Directory with filetype ${fileType}`);
        }
    }

    getFileStream(objStore: any): NodeJS.ReadableStream {

    }
}