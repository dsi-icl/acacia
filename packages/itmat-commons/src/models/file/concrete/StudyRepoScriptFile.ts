import { IStudyFileNode } from '../abstract/IStudyFileNode';
import { ScriptFileNode } from '../abstract/ScriptFileNode';
import { fileTypes } from '../abstract/fileTypes';
import { IFileMongoEntry } from '../abstract/mongoEntry';

export class StudyRepoScriptFile extends ScriptFileNode implements IStudyFileNode {
    private readonly _studyId: string;

    constructor({
        id,
        fileName,
        uploadedBy,
        deleted,
        content,
        studyId
    }:{
        id?: string,
        fileName: string,
        uploadedBy: string,
        deleted?: number | null,
        content?: string,
        studyId: string
    }) {
        super({ id, fileName, fileType: fileTypes.STUDY_REPO_SCRIPT_FILE, uploadedBy, deleted, content });
        this._studyId = studyId;
    }

    static makeFromMongoEntry(entry: IFileMongoEntry): StudyRepoScriptFile {
        const { id, fileName, fileType, uploadedBy, deleted, content, studyId } = entry;
        if (entry.fileType !== fileTypes.STUDY_REPO_SCRIPT_FILE) {
            throw new Error('Cannot instantiate FileNode with entry: wrong type.');
        }
        if (
            id === undefined ||
            fileName === undefined ||
            fileType === undefined ||
            uploadedBy === undefined ||
            deleted === undefined ||
            content === undefined ||
            studyId === undefined
        ) {
            throw new Error('Cannot instantiate FileNode with entry: missing key.');
        }
        return new StudyRepoScriptFile({ id, fileName, uploadedBy, deleted, content, studyId });
    }

    // @override
    serialiseToMongoObj(): IFileMongoEntry {
        return ({
            id: this.id,
            fileName: this.fileName,
            studyId: this._studyId,
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

    get studyId() { return this._studyId; }
}