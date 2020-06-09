import { IStudyFileNode } from '../abstract/IStudyFileNode';
import { DirectoryNode } from '../abstract/DirectoryNode';
import { IFileMongoEntry } from '../abstract/mongoEntry';
import { fileTypes } from '../abstract/fileTypes';

export class StudyRepoDir extends DirectoryNode implements IStudyFileNode {
    private readonly _studyId: string;

    constructor({
        id,
        fileName,
        uploadedBy,
        deleted,
        isRoot,
        childFileIds,
        studyId
    }: {
        id?: string,
        fileName: string,
        uploadedBy: string,
        deleted?: number | null,
        isRoot?: boolean,
        childFileIds?: string[],
        studyId: string
    }) {
        super({ id, fileName, fileType: fileTypes.USER_PERSONAL_DIR, uploadedBy, isRoot, childFileIds, deleted });
        this._studyId = studyId;
    }

    static makeFromMongoEntry(entry: IFileMongoEntry): StudyRepoDir {
        const { id, fileName, fileType, uploadedBy, deleted, isRoot, childFileIds, studyId } = entry;
        if (fileType !== fileTypes.STUDY_REPO_DIR) {
            throw new Error('Cannot instantiate FileNode with entry: wrong type.');
        }
        if (
            id === undefined ||
            fileName === undefined ||
            fileType === undefined ||
            uploadedBy === undefined ||
            deleted === undefined ||
            isRoot === undefined  ||
            childFileIds === undefined ||
            studyId === undefined
        ) {
            throw new Error('Cannot instantiate FileNode with entry: missing key.');
        }
        return new StudyRepoDir({ id, fileName, uploadedBy, deleted, isRoot, childFileIds, studyId });
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
