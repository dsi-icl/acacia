import React from 'react';
import { UPLOAD_FILE } from '../../../../graphql/files';
import { Mutation } from 'react-apollo';
import { IFile } from 'itmat-utils/dist/models/file';

export const FileList: React.FunctionComponent<{ files: IFile[] }> = ({ files }) => {
    return <div>
        <table>
            <thead>
                <tr>
                    <th>Name</th>
                    <th>Description</th>
                    <th>Size</th>
                    <th></th>
                </tr>
            </thead>
            <tbody>
                {files.map(el => <OneFile file={el} key={el.id}/>)}
            </tbody>
        </table>
    </div>;
};

const OneFile: React.FunctionComponent<{ file: IFile }> = ({ file }) => {
    return <tr>
        <td>{file.fileName}</td>
        <td>{file.description}</td>
        <td>{file.fileSize}</td>
        <td><a download={file.fileName} href={`http://localhost:3003/file/${file.id}`}
        ><button>Download</button></a></td>
    </tr>;
};