import { IStudyFileNode } from '../abstract/IStudyFileNode';
import { DirectoryNode } from '../abstract/DirectoryNode';
import { fileTypes } from '../abstract/fileTypes';

class StudyRepoDir extends DirectoryNode implements IStudyFileNode {
    private readonly _studyId: string;

    constructor(
        id: string | undefined,
        fileName: string,
        requesterId: string,
        studyId: string,
        root: boolean | undefined
    ) {
        super(id, fileName, fileTypes.USER_PERSONAL_DIR, requesterId, root);
        this._studyId = studyId;
    }

    get studyId() {
        return this._studyId;
    }
}