import React, { useState } from 'react';
import { useMutation } from 'react-apollo';
import { Table, Button, notification } from 'antd';
import { IFile } from 'itmat-commons/dist/models/file';
import { DeleteOutlined, CloudDownloadOutlined } from '@ant-design/icons';
import { DELETE_FILE } from 'itmat-commons/dist/graphql/files';
import { ApolloError } from 'apollo-client';

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

    const [isDeleting, setIsDeleting] = useState<{ [key: string]: boolean }>({});
    const [deleteFile] = useMutation(DELETE_FILE, {
        onError: (error: ApolloError) => {
            notification.error({
                message: 'Upload error!',
                description: error.message ?? 'Unknown Error Occurred!',
                placement: 'topRight',
                duration: 0,
            });
        }
    });

    const deletionHandler = (fileId: string) => {
        setIsDeleting({
            ...isDeleting,
            [fileId]: true
        });
        deleteFile({
            variables: {
                fileId
            },
            refetchQueries: ['getStudy']
        });
    };

    const columns = [
        {
            title: 'Name',
            dataIndex: 'fileName',
            key: 'fileName',
            sorter: (a, b) => a.fileName.localeCompare(b.fileName)
        },
        {
            title: 'Description',
            dataIndex: 'description',
            key: 'description'
        },
        {
            title: 'Size',
            dataIndex: 'fileSize',
            render: (size) => formatBytes(size),
            key: 'size'
        },
        {
            render: (rec, file) => (
                <Button icon={<CloudDownloadOutlined />} download={file.fileName} href={`/file/${file.id}`}>
                    Download
                </Button>
            ),
            key: 'download'
        },
        {
            render: (rec, file) => (
                <Button icon={<DeleteOutlined />} loading={isDeleting[file.id]} danger onClick={() => deletionHandler(file.id)}>
                    Delete
                </Button>
            ),
            key: 'delete'
        }
    ];

    return <Table rowKey={(rec) => rec.id} pagination={false} columns={columns} dataSource={files} size="middle" />;

};