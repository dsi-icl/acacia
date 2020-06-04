import { IStudyFileNode } from '../abstract/IStudyFileNode';
import { PatientDataBlobFile } from './PatientDataBlobFile';
import { ObjectStore } from 'itmat-utils';
import { fileTypes } from '../abstract/fileTypes';
import { ObjStoreFileNode } from '../abstract/ObjStoreFileNode';
import { IFileMongoEntry } from '../abstract/mongoEntry';

export class StudyRepoObjStoreFile extends ObjStoreFileNode implements IStudyFileNode {
    private readonly _studyId: string;

    constructor(
        id: string | undefined,
        fileName: string,
        uploadedBy: string,
        description: string,
        uri: string,
        fileSize: number | undefined,
        studyId: string
    ) {
        super(id, fileName, fileTypes.STUDY_REPO_OBJ_STORE_FILE, uploadedBy, description, uri, fileSize);
        this._studyId = studyId;
    }

    static makeFromMongoEntry(entry: IFileMongoEntry): StudyRepoObjStoreFile {
        if (entry.fileType !== fileTypes.STUDY_REPO_OBJ_STORE_FILE) {
            throw new Error(`Cannot instantiate StudyRepoObjStoreFile with entry of type ${entry.fileType}.`);
        }
        const mustHaveProperties = [
            'id',
            'fileName',
            'fileType',
            'uploadedBy',
            'studyId',
            'uri',
            'description'
        ];
        for (const each of mustHaveProperties) {
            if (!entry.hasOwnProperty(each)) {
                throw new Error(`Cannot instantiate FileNode with entry: missing key "${each}"`);
            }
        }
        const file = new StudyRepoObjStoreFile(
            entry.id,
            entry.fileName,
            entry.uploadedBy,
            entry.description!,
            entry.uri!,
            entry.fileSize,
            entry.studyId!
        );
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
            fileSize: this.fileSize,
            content: undefined,
            description: this.description,
            uploadedBy: this.uploadedBy,
            isRoot: undefined,
            patientId: undefined,
            dataVersionId: undefined,
            childFileIds: undefined,
            deleted: this.deleted
        });
    }

    makePatientBlobFile(patientId: string, dataVersionId: string): PatientDataBlobFile {
        return new PatientDataBlobFile(this, patientId, dataVersionId);
    }

    async getFileStream(objStore: ObjectStore): Promise<NodeJS.ReadableStream> {
        return objStore.downloadFile(this.studyId, this.uri);
    }

    get studyId() { return this._studyId; }
}