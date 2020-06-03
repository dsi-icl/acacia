import { IUserPersonalFileNode } from '../abstract/IUserPersonalFileNode';
import { ScriptFileNode } from '../abstract/ScriptFileNode';
import { fileTypes } from '../abstract/fileTypes';

class UserPersonalFile extends ScriptFileNode implements IUserPersonalFileNode {
    private readonly _userId: string;

    constructor(
        id: string | undefined,
        fileName: string,
        userId: string
    ) {
        super(id, fileName, fileTypes.USER_PERSONAL_FILE, userId);
        this._userId = userId;
    }

    get userId() {
        return this._userId;
    }
}