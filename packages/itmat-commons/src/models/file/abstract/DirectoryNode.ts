import { FileNode } from './FileNode';
import { fileTypes, fileTypesDirs } from './fileTypes';
import { IFileMongoEntry } from './mongoEntry';
import { Collection, FindAndModifyWriteOpResultObject } from 'mongodb';

export class DirectoryNode extends FileNode {
    private _childFileIds: string[];
    private _isRoot: boolean;

    constructor(
        {
            id,
            fileName,
            fileType,
            uploadedBy,
            isRoot = false,
            childFileIds = [],
            deleted = null
        }: {
            id?: string,
            fileName: string,
            fileType: fileTypes,
            uploadedBy: string,
            isRoot: boolean,
            childFileIds: string[],
            deleted?: number | null
        }
    ) {
        super({ id, fileName, fileType, uploadedBy, deleted });
        if (!fileTypesDirs.includes(fileType)) {
            throw new Error(`Cannot instantiate Directory with filetype ${fileType}`);
        }
        this._childFileIds = childFileIds;
        this._isRoot = isRoot;
    }

    static makeFromMongoEntry(entry: IFileMongoEntry): DirectoryNode {
        const { id, fileName, fileType, uploadedBy, deleted, isRoot, childFileIds } = entry;
        if (!fileTypesDirs.includes(fileType)) {
            throw new Error('Cannot instantiate FileNode with entry: wrong type.');
        }
        if (
            id === undefined ||
            fileName === undefined ||
            fileType === undefined ||
            uploadedBy === undefined ||
            deleted === undefined ||
            isRoot === undefined  ||
            childFileIds === undefined
        ) {
            throw new Error('Cannot instantiate FileNode with entry: missing key.');
        }
        return new DirectoryNode({ id, fileName, fileType, uploadedBy, deleted, isRoot, childFileIds });
    }

    // @override
    serialiseToMongoObj(): IFileMongoEntry {
        return ({
            id: this.id,
            fileName: this.fileName,
            studyId: undefined,
            projectId: undefined,
            fileType: this.fileType,
            fileSize: undefined,
            content: undefined,
            description: undefined,
            uploadedBy: this.uploadedBy,
            isRoot: this._isRoot,
            patientId: undefined,
            dataVersionId: undefined,
            childFileIds: this._childFileIds,
            deleted: this.deleted
        });
    }


    // addChildNodeAndUpdateMongo(collection: Collection, file: FileNode): Promise<FindAndModifyWriteOpResultObject<IFileMongoEntry>>{
    //     // TO_DO
    //     // this.childFileIds
    // }

    // @override
    deleteFileOnMongo(collection: Collection): Promise<FindAndModifyWriteOpResultObject<IFileMongoEntry>> {
        if (this._isRoot === true) {
            throw new Error('Cannot delete root directory');
        }
        return super.deleteFileOnMongo(collection);
    }

    get isRoot() { return this._isRoot; }
    protected get childFileIds() { return this._childFileIds; }

    protected setChildFileIds(value: string[]) { this._childFileIds = value; }

    getChildFiles(collection: Collection): Promise<FileNode[]> {
        return collection.find({ deleted: null, id: { $in: this._childFileIds } }).toArray();
    }

}