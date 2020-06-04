import { IUserPersonalFileNode } from '../abstract/IUserPersonalFileNode';
import { DirectoryNode } from '../abstract/DirectoryNode';
import { fileTypes } from '../abstract/fileTypes';
import { IFileMongoEntry } from '../abstract/mongoEntry';

export class UserPersonalDir extends DirectoryNode implements IUserPersonalFileNode {
    private readonly _userId: string;

    constructor({
            id,
            fileName,
            userId,
            deleted,
            isRoot,
            childFileIds
    }: {
        id?: string,
        fileName: string,
        userId: string,
        deleted?: number | null,
        isRoot?: boolean,
        childFileIds?: string[]
    }) {
        super({ id, fileName, fileType: fileTypes.USER_PERSONAL_DIR, uploadedBy: userId, deleted, isRoot, childFileIds });
        this._userId = userId;
    }

    static makeFromMongoEntry(entry: IFileMongoEntry): UserPersonalDir {
        const { id, fileName, fileType, uploadedBy, deleted, isRoot, childFileIds, studyId } = entry;
        if (fileType !== fileTypes.USER_PERSONAL_DIR) {
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
        return new UserPersonalDir({ id, fileName, userId: uploadedBy, deleted, isRoot, childFileIds });
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
            isRoot: this.isRoot,
            patientId: undefined,
            dataVersionId: undefined,
            childFileIds: this.childFileIds,
            deleted: this.deleted
        });
    }

    get userId() { return this._userId; }
}