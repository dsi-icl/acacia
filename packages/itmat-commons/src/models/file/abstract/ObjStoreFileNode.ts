import { FileNode } from './FileNode';
import { fileTypes, fileTypesObjStore } from './fileTypes';
import { ObjectStore } from '../../../utils';

export abstract class ObjStoreFileNode extends FileNode {
    private readonly _uri: string;
    private readonly _fileSize?: number;
    private _description: string;

    constructor({
        id,
        fileName,
        fileType,
        uploadedBy,
        deleted,
        description = '',
        uri,
        fileSize
    }: {
        id?: string,
        fileName: string,
        fileType: fileTypes,
        uploadedBy: string,
        deleted?: number | null,
        description?: string,
        uri: string,
        fileSize?: number,
    }) {
        super({ id, fileName, fileType, uploadedBy, deleted });
        if (!fileTypesObjStore.includes(fileType)) {
            throw new Error(`Cannot instantiate ObjStoreFileNode with filetype ${fileType}`);
        }
        this._uri = uri;
        this._fileSize = fileSize;
        this._description = description;
    }

    abstract getFileStream(objStore: ObjectStore): Promise<NodeJS.ReadableStream>;

    get uri() { return this._uri; }
    get fileSize() { return this._fileSize; }
    get description() { return this._description; }
}
