import React from 'react';
import { UPLOAD_FILE } from '../../graphql/files';
import { Mutation } from 'react-apollo';
import { IFile } from 'itmat-utils/dist/models/file';

/* https://stackoverflow.com/questions/15900485/correct-way-to-convert-size-in-bytes-to-kb-mb-gb-in-javascript */
function formatBytes(a: number, b?: number){if(0==a)return"0 Bytes";var c=1024,d=b||2,e=["Bytes","KB","MB","GB","TB","PB","EB","ZB","YB"],f=Math.floor(Math.log(a)/Math.log(c));return parseFloat((a/Math.pow(c,f)).toFixed(d))+" "+e[f]}

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
        <td>{(file.fileSize && formatBytes(file.fileSize, 1)) || 'Unknown'}</td>
        <td><a download={file.fileName} href={`http://localhost:3003/file/${file.id}`}
        ><button>Download</button></a></td>
    </tr>;
};