import { FileNode } from './FileNode';
import { fileTypes, fileTypesScript } from './fileTypes';
import { IFileMongoEntry } from './mongoEntry';

export class ScriptFileNode extends FileNode {
    private _content: string;

    constructor(
        {
            id,
            fileName,
            fileType,
            uploadedBy,
            deleted,
            content = ''
        }: {
            id?: string,
            fileName: string,
            fileType: fileTypes,
            uploadedBy: string,
            deleted?: number | null,
            content?: string
        }
    ) {
        super({ id, fileName, fileType, uploadedBy, deleted });
        if (!fileTypesScript.includes(fileType)) {
            throw new Error(`Cannot instantiate ScriptFileNode with filetype ${fileType}`);
        }
        this._content = content;
    }

    static makeFromMongoEntry(entry: IFileMongoEntry): ScriptFileNode {
        const { id, fileName, fileType, uploadedBy, deleted, content } = entry;
        if (!fileTypesScript.includes(fileType)) {
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
        return new ScriptFileNode({ id, fileName, fileType, uploadedBy, content, deleted });
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
            content: this._content,
            description: undefined,
            uploadedBy: this.uploadedBy,
            isRoot: undefined,
            patientId: undefined,
            dataVersionId: undefined,
            childFileIds: undefined,
            deleted: this.deleted
        });
    }


    updateContent({ newContent, appendMode = false }: { newContent: string, appendMode: boolean }) {
        if (appendMode) {
            this._content += newContent;
        } else {
            this._content = newContent;
        }
    }

    get content() { return this._content; }
}