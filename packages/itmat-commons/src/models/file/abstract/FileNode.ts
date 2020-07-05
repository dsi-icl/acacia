import { v4 as uuid } from 'uuid';
import { fileTypes } from './fileTypes';
import { IFileMongoEntry } from './mongoEntry';
import { Collection, FindAndModifyWriteOpResultObject, InsertOneWriteOpResult, ObjectID } from 'mongodb';

export class FileNode {
    private readonly _id;
    private _fileName: string;
    private readonly _fileType: fileTypes;
    private readonly _uploadedBy: string;
    private _deleted: number | null;

    constructor(
        {
            id = uuid(),
            fileName,
            fileType,
            uploadedBy,
            deleted = null
        }: {
            id?: string,
            fileName: string,
            fileType: fileTypes,
            uploadedBy: string,
            deleted?: number | null
        }
    ) {
        this._id = id;
        this._fileName = fileName;
        this._fileType = fileType;
        this._uploadedBy = uploadedBy;
        this._deleted = deleted;
    }

    static makeFromMongoEntry(entry: IFileMongoEntry): FileNode {
        const { id, fileName, fileType, uploadedBy, deleted } = entry;
        if (
            id === undefined ||
            fileName === undefined ||
            fileType === undefined ||
            uploadedBy === undefined ||
            deleted === undefined
        ) {
            throw new Error('Cannot instantiate FileNode with entry: missing key.');
        }
        return new FileNode({ id, fileName, fileType, uploadedBy, deleted });
    }

    serialiseToMongoObj(): IFileMongoEntry {
        return ({
            id: this._id,
            fileName: this._fileName,
            studyId: undefined,
            projectId: undefined,
            fileType: this._fileType,
            fileSize: undefined,
            description: undefined,
            content: undefined,
            uploadedBy: this._uploadedBy,
            isRoot: undefined,
            patientId: undefined,
            dataVersionId: undefined,
            childFileIds: undefined,
            deleted: this._deleted
        });
    }

    static getFileFromMongo(fileCollection: Collection, query: { id?: string, fileName?: string }): Promise<IFileMongoEntry | null> {
        return fileCollection.findOne({ ...query, deleted: null });
    }

    deleteFileOnMongo(fileCollection: Collection): Promise<FindAndModifyWriteOpResultObject<IFileMongoEntry>> {
        return fileCollection.findOneAndUpdate({ id: this._id, deleted: null, isRoot: { $ne: true } }, { deleted: new Date().valueOf() });
    }

    uploadFileToMongo(fileCollection: Collection): Promise<InsertOneWriteOpResult<IFileMongoEntry & { _id: ObjectID } >> {
        return fileCollection.insertOne(this.serialiseToMongoObj());
    }

    get id() { return this._id; }
    get fileName() { return this._fileName; }
    get fileType() { return this._fileType; }
    get uploadedBy() { return this._uploadedBy; }
    get deleted() { return this._deleted; }
}
