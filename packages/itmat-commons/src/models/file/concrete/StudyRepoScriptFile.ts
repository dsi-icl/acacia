import { IStudyFileNode } from '../abstract/IStudyFileNode';
import { ScriptFileNode } from '../abstract/ScriptFileNode';
import { fileTypes } from '../abstract/fileTypes';

class StudyRepoScriptFile extends ScriptFileNode implements IStudyFileNode {
    private readonly _studyId: string;

    constructor(
        id: string | undefined,
        fileName: string,
        userId: string
    ) {
        super(id, fileName, fileTypes.STUDY_REPO_FILE, userId);
        this._studyId = userId;
    }

    get studyId() {
        return this._studyId;
    }
}