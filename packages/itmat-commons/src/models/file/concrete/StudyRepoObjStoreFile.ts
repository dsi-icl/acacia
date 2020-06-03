import { IStudyFileNode } from '../abstract/IStudyFileNode';
import { ScriptFileNode } from '../abstract/ScriptFileNode';
import { PatientDataBlobFile } from './PatientDataBlobFile';
import { fileTypes } from '../abstract/fileTypes';

export class StudyRepoObjStoreFile extends ScriptFileNode implements IStudyFileNode {
    private readonly _studyId: string;

    constructor(
        id: string | undefined,
        fileName: string,
        studyId: string
    ) {
        super(id, fileName, fileTypes.STUDY_REPO_FILE, userId);
        this._studyId = studyId;
    }

    get studyId() {
        return this._studyId;
    }

    makePatientBlobFile(patientId: string, dataVersionId: string): PatientDataBlobFile  {

    }

}