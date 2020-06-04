import { StudyRepoObjStoreFile } from './StudyRepoObjStoreFile';
import { IFileMongoEntry } from '../abstract/mongoEntry';
import { fileTypes } from '../abstract/fileTypes';

export class PatientDataBlobFile extends StudyRepoObjStoreFile {
    private readonly _patientId: string;
    private readonly _dataVersionId: string;

    constructor({
        studyFile,
        patientId,
        dataVersionId
    }: {
        studyFile: StudyRepoObjStoreFile,
        patientId: string,
        dataVersionId: string
    }) {
        super({
            id: studyFile.id,
            fileName: studyFile.fileName,
            uploadedBy: studyFile.uploadedBy,
            deleted: studyFile.deleted,
            description: studyFile.description,
            uri: studyFile.uri,
            fileSize: studyFile.fileSize,
            studyId: studyFile.studyId
        });
        this._patientId = patientId;
        this._dataVersionId = dataVersionId;
    }

    static makeFromMongoEntry(entry: IFileMongoEntry): PatientDataBlobFile {
        const { id, fileName, fileType, uploadedBy, deleted, uri, fileSize, description, studyId, patientId, dataVersionId } = entry;
        if (entry.fileType !== fileTypes.STUDY_REPO_OBJ_STORE_FILE) {
            throw new Error('Cannot instantiate FileNode with entry: wrong type.');
        }
        if (
            id === undefined ||
            fileName === undefined ||
            fileType === undefined ||
            uploadedBy === undefined ||
            deleted === undefined ||
            uri === undefined ||
            description === undefined ||
            studyId === undefined ||
            patientId === undefined ||
            dataVersionId === undefined
        ) {
            throw new Error('Cannot instantiate FileNode with entry: missing key.');
        }
        const studyFile = new StudyRepoObjStoreFile({ id, fileName, uploadedBy, deleted, uri, description, fileSize, studyId });
        return new PatientDataBlobFile({ studyFile, patientId, dataVersionId });
    }

    // @override
    serialiseToMongoObj(): IFileMongoEntry {
        return ({
            id: this.id,
            fileName: this.fileName,
            studyId: this.studyId,
            projectId: undefined,
            fileType: this.fileType,
            fileSize: this.fileSize,
            content: undefined,
            description: this.description,
            uploadedBy: this.uploadedBy,
            isRoot: undefined,
            patientId: this._patientId,
            dataVersionId: this._dataVersionId,
            childFileIds: undefined,
            deleted: this.deleted
        });
    }


    get patientId() { return this._patientId; }
    get dataVersionId() { return this._dataVersionId; }
}