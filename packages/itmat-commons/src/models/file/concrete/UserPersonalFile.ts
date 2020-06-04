import { IUserPersonalFileNode } from '../abstract/IUserPersonalFileNode';
import { ScriptFileNode } from '../abstract/ScriptFileNode';
import { fileTypes } from '../abstract/fileTypes';
import { IFileMongoEntry } from '../abstract/mongoEntry';

export class UserPersonalFile extends ScriptFileNode implements IUserPersonalFileNode {
    private readonly _userId: string;

    constructor(
        id: string | undefined,
        fileName: string,
        userId: string,
        content: string | undefined
    ) {
        super(id, fileName, fileTypes.USER_PERSONAL_FILE, userId, content);
        this._userId = userId;
    }

    static makeFromMongoEntry(entry: IFileMongoEntry): UserPersonalFile {
        if (entry.fileType !== fileTypes.USER_PERSONAL_FILE) {
            throw new Error(`Cannot instantiate FileNode with entry: wrong type.`);
        }
        const mustHaveProperties = [
            'id',
            'fileName',
            'fileType',
            'uploadedBy',
            'isRoot',
            'content'
        ];
        for (const each of mustHaveProperties) {
            if (!entry.hasOwnProperty(each)) {
                throw new Error(`Cannot instantiate FileNode with entry: missing key "${each}"`);
            }
        }
        const file = new UserPersonalFile(entry.id, entry.fileName, entry.uploadedBy, entry.content);
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