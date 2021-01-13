import React, { useState } from 'react';
import { useMutation, useQuery } from '@apollo/client/react/hooks';
import { Table, Button, notification, Input } from 'antd';
import { IFile, DELETE_FILE, WHO_AM_I, userTypes, GET_ORGANISATIONS } from 'itmat-commons';
import { DeleteOutlined, CloudDownloadOutlined, SwapRightOutlined } from '@ant-design/icons';
import { ApolloError } from '@apollo/client/errors';
import moment from 'moment';
import { deviceTypes } from '../../datasetDetail/tabContent/files/fileTab';
import Highlighter from 'react-highlight-words';
import LoadSpinner from '../loadSpinner';

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

    const [searchTerm, setSearchTerm] = useState<string | undefined>();
    const [isDeleting, setIsDeleting] = useState<{ [key: string]: boolean }>({});
    const { data: dataWhoAmI, loading: loadingWhoAmI } = useQuery(WHO_AM_I);
    const [deleteFile] = useMutation(DELETE_FILE, {
        errorPolicy: 'ignore',
        onError: (error: ApolloError) => {
            notification.error({
                message: 'Deletion error!',
                description: error.message ?? 'Unknown Error Occurred!',
                placement: 'topRight',
                duration: 0,
            });
        }
    });
    const { loading: getOrgsLoading, error: getOrgsError, data: getOrgsData } = useQuery(GET_ORGANISATIONS);

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

    if (getOrgsLoading)
        return <LoadSpinner />;

    if (getOrgsError)
        return <>A error occured, please contact your administrator: {getOrgsError.message}</>;

    const sites = getOrgsData.getOrganisations.filter(org => org.metadata?.siteIDMarker).reduce((prev, current) => ({
        ...prev,
        [current.metadata.siteIDMarker]: current.shortname ?? current.name
    }), {});

    const columns = [
        {
            title: 'Participant ID',
            dataIndex: 'participantId',
            key: 'participantId',
            render: (__unused__value, record) => {
                const participantId = JSON.parse(record.description).participantId;
                if (searchTerm)
                    return <Highlighter searchWords={[searchTerm]} textToHighlight={participantId} highlightStyle={{
                        backgroundColor: '#FFC733',
                        padding: 0
                    }} />;
                else
                    return participantId;
            }
        },
        {
            title: 'Site',
            key: 'site',
            render: (__unused__value, record) => sites[JSON.parse(record.description).participantId[0]],
            sorter: (a, b) => JSON.parse(a.description).participantId.localeCompare(JSON.parse(b.description).participantId)
        },
        {
            title: 'Device ID',
            dataIndex: 'deviceId',
            key: 'deviceId',
            render: (__unused__value, record) => {
                const deviceId = JSON.parse(record.description).deviceId;
                if (searchTerm)
                    return <Highlighter searchWords={[searchTerm]} textToHighlight={deviceId} highlightStyle={{
                        backgroundColor: '#FFC733',
                        padding: 0
                    }} />;
                else
                    return deviceId;
            }
        },
        {
            title: 'Device Type',
            key: 'deviceType',
            render: (__unused__value, record) => deviceTypes[JSON.parse(record.description).deviceId.substr(0, 3)],
            sorter: (a, b) => JSON.parse(a.description).deviceId.localeCompare(JSON.parse(b.description).deviceId)
        },
        {
            title: 'Period',
            dataIndex: 'period',
            key: 'period',
            render: (__unused__value, record) => {
                const { startDate, endDate } = JSON.parse(record.description);
                return <>{moment(startDate).format('YYYY-MM-DD')}&nbsp;&nbsp;<SwapRightOutlined />&nbsp;&nbsp;{moment(endDate).format('YYYY-MM-DD')}</>;
            }
        },
        {
            title: 'Uploaded',
            dataIndex: 'uploadTime',
            key: 'uploadTime',
            render: (value) => moment(parseInt(value)).format('YYYY-MM-DD'),
            sorter: (a, b) => parseInt(a.uploadTime) - parseInt(b.uploadTime)
        },
        {
            title: 'Size',
            dataIndex: 'fileSize',
            render: (size) => formatBytes(size),
            width: '8rem',
            key: 'size'
        },
        {
            title: 'Hash',
            dataIndex: 'hash',
            key: 'hash',
            render: (__unused__value, record) => record.hash
        },
        {
            render: (__unused__value, record) => {
                const ext = record.fileName.substr(record.fileName.lastIndexOf('.')).toLowerCase();
                const file = JSON.parse(record.description);
                const startDate = moment(file.startDate).format('YYYYMMDD');
                const endDate = moment(file.endDate).format('YYYYMMDD');
                return <Button icon={<CloudDownloadOutlined />} download={`${file.participantId}-${file.deviceId}-${startDate}-${endDate}.${ext}`} href={`/file/${record.id}`}>
                    Download
                </Button>;
            },
            width: '10rem',
            key: 'download'
        }]
        .concat(!loadingWhoAmI && dataWhoAmI?.whoAmI?.type === userTypes.ADMIN ? [
            {
                render: (__unused__value, record) => (
                    <Button icon={<DeleteOutlined />} loading={isDeleting[record.id]} danger onClick={() => deletionHandler(record.id)}>
                        Delete
                    </Button>
                ),
                width: '8rem',
                key: 'delete'
            }
        ] : []);

    return <>
        <Input.Search allowClear placeholder='Search' onChange={({ target: { value } }) => setSearchTerm(value?.toUpperCase())} />
        <br />
        <br />
        <Table
            rowKey={(rec) => rec.id}
            pagination={false}
            columns={columns}
            dataSource={files.filter(file => !searchTerm || file.description.search(searchTerm) > -1).sort((a, b) => parseInt(b.uploadTime) - parseInt(a.uploadTime))}
            size='small' />
    </>;

};
