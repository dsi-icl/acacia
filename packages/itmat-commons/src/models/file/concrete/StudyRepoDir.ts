import { IStudyFileNode } from '../abstract/IStudyFileNode';
import { DirectoryNode } from '../abstract/DirectoryNode';
import { IFileMongoEntry } from '../abstract/mongoEntry';
import { fileTypes } from '../abstract/fileTypes';

export class StudyRepoDir extends DirectoryNode implements IStudyFileNode {
    private readonly _studyId: string;

    constructor(
        id: string | undefined,
        fileName: string,
        requesterId: string,
        isRoot: boolean | undefined,
        childFileIds: string[] | undefined,
        studyId: string
    ) {
        super(id, fileName, fileTypes.USER_PERSONAL_DIR, requesterId, isRoot, childFileIds);
        this._studyId = studyId;
    }

    static makeFromMongoEntry(entry: IFileMongoEntry): StudyRepoDir {
        if (entry.fileType !== fileTypes.STUDY_REPO_DIR) {
            throw new Error(`Cannot instantiate StudyRepoDir with entry of type ${entry.fileType}.`);
        }
        const mustHaveProperties = [
            'id',
            'fileName',
            'fileType',
            'uploadedBy',
            'isRoot',
            'childFileIds',
            'studyId'
        ];
        for (const each of mustHaveProperties) {
            if (!entry.hasOwnProperty(each)) {
                throw new Error(`Cannot instantiate FileNode with entry: missing key "${each}"`);
            }
        }
        const file = new StudyRepoDir(entry.id, entry.fileName, entry.uploadedBy, entry.isRoot, entry.childFileIds, entry.studyId!);
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

    get studyId() { return this._studyId; }
}