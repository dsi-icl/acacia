import { IUserPersonalFileNode } from '../abstract/IUserPersonalFileNode';
import { ScriptFileNode } from '../abstract/ScriptFileNode';
import { fileTypes } from '../abstract/fileTypes';
import { IFileMongoEntry } from '../abstract/mongoEntry';

export class UserPersonalFile extends ScriptFileNode implements IUserPersonalFileNode {
    private readonly _userId: string;

    constructor({
        id,
        fileName,
        userId,
        deleted,
        content
    }: {
        id?: string,
        fileName: string,
        userId: string,
        deleted?: number | null,
        content?: string
    }) {
        super({ id, fileName, fileType: fileTypes.USER_PERSONAL_FILE, uploadedBy: userId, deleted, content });
        this._userId = userId;
    }

    static makeFromMongoEntry(entry: IFileMongoEntry): UserPersonalFile {
        const { id, fileName, fileType, uploadedBy, deleted, content } = entry;
        if (fileType !== fileTypes.USER_PERSONAL_FILE) {
            throw new Error('Cannot instantiate FileNode with entry: wrong type.');
        }
        if (
            id === undefined ||
            fileName === undefined ||
            fileType === undefined ||
            uploadedBy === undefined ||
            deleted === undefined ||
            content === undefined
        ) {
            throw new Error('Cannot instantiate FileNode with entry: missing key.');
        }
        return new UserPersonalFile({ id, fileName, userId: uploadedBy, content, deleted });
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
            content: this.content,
            description: undefined,
            uploadedBy: this.uploadedBy,
            isRoot: undefined,
            patientId: undefined,
            dataVersionId: undefined,
            childFileIds: undefined,
            deleted: this.deleted
        });
    }

    get userId() { return this._userId; }
}
