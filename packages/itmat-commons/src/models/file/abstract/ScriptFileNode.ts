import { FileNode } from './FileNode';
import { fileTypes } from './fileTypes';

export abstract class ScriptFileNode extends FileNode {
    private _content: string;

    constructor(
        id: string | undefined,
        fileName: string,
        fileType: fileTypes,
        uploadedBy: string
    ) {
        super(id, fileName, fileType, uploadedBy);
        if (![
            fileTypes.STUDY_REPO_FILE,
            fileTypes.USER_PERSONAL_FILE
        ].includes(fileType)) {
            throw new Error(`Cannot instantiate Directory with filetype ${fileType}`);
        }
        this._content = '';
    }

    updateContent({ newContent, appendMode = false }: { newContent: string, appendMode: boolean }) {
        if (appendMode) {
            this._content += newContent;
        } else {
            this._content = newContent;
        }
    }

    get content() {
        return this._content;
    }
}