import React from 'react';
import { Table, Button } from 'antd';
import { IFile } from 'itmat-commons/dist/models/file';

export function formatBytes(size: number, decimal: number = 2) {
    if (size === 0) {
        return '0 B';
    }
    const base = 1024;
    const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const order = Math.floor(Math.log(size) / Math.log(base));
    return parseFloat((size / Math.pow(base, order)).toFixed(decimal)) + ' ' + units[order];
}

export const FileList: React.FunctionComponent<{ files: IFile[] }> = ({ files }) => {

    const columns = [
        {
            title: 'Name',
            dataIndex: 'fileName',
            sorter: (a, b) => a.fileName.localeCompare(b.fileName)
        },
        {
            title: 'Description',
            dataIndex: 'description'
        },
        {
            title: 'Size',
            dataIndex: 'fileSize',
            render: (size) => formatBytes(size)
        },
        {
            render: (rec, file) => <Button download={file.fileName} href={`${process.env.REACT_APP_FILE_SERVICE}/${file.id}`}>Download</Button>
        }
    ];

    return <Table pagination={false} columns={columns} dataSource={files} size="middle" />;

};