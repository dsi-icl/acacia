import React from 'react';
import { IFile } from 'itmat-commons';
import { useMutation, useQuery } from 'react-apollo';
import { WHO_AM_I, LOG_ACTION, WRITE_LOG, LOG_STATUS } from 'itmat-commons';
import { logFun } from '../../../utils/logUtils';

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
    // prepare for logging
    const [writeLog, { loading: writeLogLoading }] = useMutation(WRITE_LOG);
    const { loading: whoamiloading, error: whoamierror, data: whoamidata } = useQuery(WHO_AM_I);
    if (whoamiloading) { return <p>Loading..</p>; }
    if (whoamierror) { return <p>ERROR: please try again.</p>; }

    return <tr>
        <td>{file.fileName}</td>
        <td>{file.description}</td>
        <td>{(file.fileSize && formatBytes(file.fileSize, 1)) || 'Unknown'}</td>
        <td>
            <a download={file.fileName} href={`http://localhost:3003/file/${file.id}`}>
                {writeLogLoading ? <button>Loading...</button> : <button onClick={() => logFun(writeLog, whoamidata, LOG_ACTION.DOWNLOAD_FILE, {fileName: file.fileName}, LOG_STATUS.SUCCESS)}>Download</button>}</a>
        </td>
    </tr>;
};
