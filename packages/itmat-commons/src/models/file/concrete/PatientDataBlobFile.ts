import { StudyRepoObjStoreFile } from './StudyRepoObjStoreFile';

export class PatientDataBlobFile extends StudyRepoObjStoreFile {
    private readonly _patientId: string;
    private readonly _dataVersionId: string;

    constructor(studyFile: StudyRepoObjStoreFile, patientId: string, dataVersionId: string) {
        super(
            studyFile.id,
            studyFile.fileName,
            studyFile.studyId
        );
        this._patientId = patientId;
        this._dataVersionId = dataVersionId;
    }

    get patientId() { return this._patientId; }

    get dataVersionId() { return this._dataVersionId; }
}