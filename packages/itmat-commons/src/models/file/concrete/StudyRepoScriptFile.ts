import { IStudyFileNode } from '../abstract/IStudyFileNode';
import { ScriptFileNode } from '../abstract/ScriptFileNode';
import { fileTypes } from '../abstract/fileTypes';
import { IFileMongoEntry } from '../abstract/mongoEntry';

export class StudyRepoScriptFile extends ScriptFileNode implements IStudyFileNode {
    private readonly _studyId: string;

    constructor(
        id: string | undefined,
        fileName: string,
        uploadedBy: string,
        studyId: string,
        content: string | undefined
    ) {
        super(id, fileName, fileTypes.STUDY_REPO_SCRIPT_FILE, uploadedBy, content);
        this._studyId = studyId;
    }

    static makeFromMongoEntry(entry: IFileMongoEntry): StudyRepoScriptFile {
        if (entry.fileType !== fileTypes.STUDY_REPO_SCRIPT_FILE) {
            throw new Error(`Cannot instantiate StudyRepoScriptFile with entry of type ${entry.fileType}.`);
        }
        const mustHaveProperties = [
            'id',
            'fileName',
            'fileType',
            'uploadedBy',
            'content',
            'studyId'
        ];
        for (const each of mustHaveProperties) {
            if (!entry.hasOwnProperty(each)) {
                throw new Error(`Cannot instantiate FileNode with entry: missing key "${each}"`);
            }
        }
        const file = new StudyRepoScriptFile(entry.id, entry.fileName, entry.uploadedBy, entry.studyId!, entry.content);
        return file;
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