import { FileNode } from './FileNode';
import { fileTypes } from './fileTypes';
import { Collection, FindAndModifyWriteOpResultObject } from 'mongodb';

export abstract class DirectoryNode extends FileNode {
    private readonly _childFiles: string[];

    constructor(
        id: string | undefined,
        fileName: string,
        fileType: fileTypes,
        uploadedBy: string,
        private readonly _isRoot: boolean = false
    ) {
        super(id, fileName, fileType, uploadedBy);
        if (![
            fileTypes.PATIENT_DATA_BLOB_DIR,
            fileTypes.STUDY_REPO_DIR,
            fileTypes.USER_PERSONAL_DIR
        ].includes(fileType)) {
            throw new Error(`Cannot instantiate Directory with filetype ${fileType}`);
        }
        this._childFiles = [];
    }

    async addChildNodeAndUpdateMongo(collection: Collection, file: FileNode): Promise<FindAndModifyWriteOpResultObject>{
        // TO_DO
        // this.childFileIds
    }

    async deleteFileOnMongo(collection: Collection): Promise<FindAndModifyWriteOpResultObject> {
        if (this.root === true) {
            throw new Error('Cannot delete root directory');
        }
        //TO_DO
    }

    get isRoot() { return this._isRoot; }

    get childFiles() {

    }

}