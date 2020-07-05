import { IStudyFileNode } from '../abstract/IStudyFileNode';
import { PatientDataBlobFile } from './PatientDataBlobFile';
import { ObjectStore } from '../../../utils';
import { fileTypes } from '../abstract/fileTypes';
import { ObjStoreFileNode } from '../abstract/ObjStoreFileNode';
import { IFileMongoEntry } from '../abstract/mongoEntry';

export class StudyRepoObjStoreFile extends ObjStoreFileNode implements IStudyFileNode {
    private readonly _studyId: string;

    constructor({
        id,
        fileName,
        uploadedBy,
        deleted,
        description,
        uri,
        fileSize,
        studyId
    }: {
        id?: string,
        fileName: string,
        uploadedBy: string,
        deleted?: number | null,
        description?: string,
        uri: string,
        fileSize?: number,
        studyId: string
    }) {
        super({ id, fileName, fileType: fileTypes.STUDY_REPO_OBJ_STORE_FILE, uploadedBy, description, uri, fileSize, deleted });
        this._studyId = studyId;
    }

    static makeFromMongoEntry(entry: IFileMongoEntry): StudyRepoObjStoreFile {
        const { id, fileName, fileType, uploadedBy, deleted, uri, fileSize, description, studyId } = entry;
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
            studyId === undefined
        ) {
            throw new Error('Cannot instantiate FileNode with entry: missing key.');
        }
        return new StudyRepoObjStoreFile({ id, fileName, uploadedBy, deleted, uri, fileSize, description, studyId });
    }

    // @override
    serialiseToMongoObj(): IFileMongoEntry {
        return ({
            id: this.id,
            fileName: this.fileName,
            studyId: this._studyId,
            projectId: undefined,
            fileType: this.fileType,
            fileSize: this.fileSize,
            content: undefined,
            description: this.description,
            uploadedBy: this.uploadedBy,
            uri: this.uri,
            isRoot: undefined,
            patientId: undefined,
            dataVersionId: undefined,
            childFileIds: undefined,
            deleted: this.deleted
        });
    }

    makePatientBlobFile(patientId: string, dataVersionId: string): PatientDataBlobFile {
        return new PatientDataBlobFile({ studyFile: this, patientId, dataVersionId });
    }

    async getFileStream(objStore: ObjectStore): Promise<NodeJS.ReadableStream> {
        return objStore.downloadFile(this.studyId, this.uri);
    }

    get studyId() { return this._studyId; }
}
