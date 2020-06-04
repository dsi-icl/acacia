import { IUserPersonalFileNode } from '../abstract/IUserPersonalFileNode';
import { DirectoryNode } from '../abstract/DirectoryNode';
import { fileTypes } from '../abstract/fileTypes';
import { IFileMongoEntry } from '../abstract/mongoEntry';

class UserPersonalDir extends DirectoryNode implements IUserPersonalFileNode {
    private readonly _userId: string;

    constructor(
        id: string | undefined,
        fileName: string,
        userId: string,
        isRoot: boolean | undefined,
        childFileIds: string[] | undefined
    ) {
        super(id, fileName, fileTypes.USER_PERSONAL_DIR, userId, isRoot, childFileIds);
        this._userId = userId;
    }

    static makeFromMongoEntry(entry: IFileMongoEntry): UserPersonalDir {
        if (entry.fileType !== fileTypes.USER_PERSONAL_DIR) {
            throw new Error(`Cannot instantiate FileNode with entry: wrong type.`);
        }
        const mustHaveProperties = [
            'id',
            'fileName',
            'fileType',
            'uploadedBy',
            'isRoot',
            'childFileIds'
        ];
        for (const each of mustHaveProperties) {
            if (!entry.hasOwnProperty(each)) {
                throw new Error(`Cannot instantiate FileNode with entry: missing key "${each}"`);
            }
        }
        const file = new UserPersonalDir(entry.id, entry.fileName, entry.uploadedBy, entry.isRoot, entry.childFileIds);
        return file;
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