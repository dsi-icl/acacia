import React from 'react';
import { IFile } from 'itmat-commons';

export function formatBytes(size: number, decimal = 2): string {
    if (size === 0) {
        return '0 B';
    }
    const base = 1024;
    const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const order = Math.floor(Math.log(size) / Math.log(base));
    return parseFloat((size / Math.pow(base, order)).toFixed(decimal)) + ' ' + units[order];
}

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
                {files.map((el) => <OneFile file={el} key={el.id} />)}
            </tbody>
        </table>
    </div>;
};

const OneFile: React.FunctionComponent<{ file: IFile }> = ({ file }) => {
    return <tr>
        <td>{file.fileName}</td>
        <td>{file.description}</td>
        <td>{(file.fileSize && formatBytes(file.fileSize, 1)) || 'Unknown'}</td>
        <td><a download={file.fileName} href={`http://localhost:3003/file/${file.id}`}
        ><button>Download</button></a></td>
    </tr>;
};
