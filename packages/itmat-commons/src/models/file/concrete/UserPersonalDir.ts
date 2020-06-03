import { IUserPersonalFileNode } from '../abstract/IUserPersonalFileNode';
import { DirectoryNode } from '../abstract/DirectoryNode';
import { fileTypes } from '../abstract/fileTypes';

class UserPersonalDir extends DirectoryNode implements IUserPersonalFileNode {
    private readonly _userId: string;

    constructor(
        id: string | undefined,
        fileName: string,
        userId: string,
        root: boolean | undefined
    ) {
        super(id, fileName, fileTypes.USER_PERSONAL_DIR, userId, root);
        this._userId = userId;
    }

    get userId() {
        return this._userId;
    }
}