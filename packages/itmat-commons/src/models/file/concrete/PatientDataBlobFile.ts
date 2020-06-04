import { StudyRepoObjStoreFile } from './StudyRepoObjStoreFile';
import { IFileMongoEntry } from '../abstract/mongoEntry';
import { fileTypes } from '../abstract/fileTypes';

export class PatientDataBlobFile extends StudyRepoObjStoreFile {
    private readonly _patientId: string;
    private readonly _dataVersionId: string;

    constructor(
        studyFile: StudyRepoObjStoreFile,
        patientId: string,
        dataVersionId: string
    ) {
        super(
            studyFile.id,
            studyFile.fileName,
            studyFile.uploadedBy,
            studyFile.description,
            studyFile.uri,
            studyFile.fileSize,
            studyFile.studyId
        );
        this._patientId = patientId;
        this._dataVersionId = dataVersionId;
    }

    static makeFromMongoEntry(entry: IFileMongoEntry): StudyRepoObjStoreFile {
        if (entry.fileType !== fileTypes.STUDY_REPO_OBJ_STORE_FILE) {
            throw new Error(`Cannot instantiate PatientDataBlobFile with entry of type ${entry.fileType}.`);
        }
        const mustHaveProperties = [
            'id',
            'fileName',
            'fileType',
            'uploadedBy',
            'studyId',
            'uri',
            'description',
            'patientId',
            'dataVersionId'
        ];
        for (const each of mustHaveProperties) {
            if (!entry.hasOwnProperty(each)) {
                throw new Error(`Cannot instantiate FileNode with entry: missing key "${each}"`);
            }
        }
        const studyFile = new StudyRepoObjStoreFile(
            entry.id,
            entry.fileName,
            entry.uploadedBy,
            entry.description!,
            entry.uri!,
            entry.fileSize,
            entry.studyId!
        );
        const file = new PatientDataBlobFile(studyFile, entry.patientId!, entry.dataVersionId!);
        return file;
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