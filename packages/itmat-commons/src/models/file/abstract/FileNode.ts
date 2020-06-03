import { v4 as uuid } from 'uuid';
import { fileTypes } from './fileTypes';
import { IFileMongoEntry } from './mongoEntry';
import { Collection } from 'mongodb';

export abstract class FileNode {
    private deleted: number | null;

    constructor(
        private readonly _id: string = uuid(),
        private _fileName: string,
        private readonly _fileType: fileTypes,
        private readonly _uploadedBy: string
    ) {
        this.deleted = null;
    }

    abstract serialiseToMongoObj(): IFileMongoEntry;
    abstract async deleteFile(fileCollection: Collection);

    get id() { return this._id; }
    get fileName() { return this._fileName; }
    get fileType() { return this._fileType; }
    get uploadedBy() { return this._uploadedBy; }
}
