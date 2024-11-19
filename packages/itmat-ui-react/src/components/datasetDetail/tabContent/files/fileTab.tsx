import React, { FunctionComponent, useState } from 'react';
import { Progress, Button, Table, List, Modal, Upload, Form, Select, Input, notification, message, Typography, Tooltip } from 'antd';
import { CloudDownloadOutlined, InboxOutlined, NumberOutlined } from '@ant-design/icons';
import { enumConfigType, IStudyConfig, IStudy, IField, enumDataTypes, IStudyFileBlock, enumUserTypes, IUserWithoutToken, deviceTypes, enumStudyBlockColumnValueType, IFile } from '@itmat-broker/itmat-types';
import LoadSpinner from '../../../reusable/loadSpinner';
import css from './fileRepo.module.css';
import { trpc } from '../../../../utils/trpc';
import { formatBytes, stringCompareFunc, tableColumnRender } from '../../../../utils/tools';
import { UploadChangeParam } from 'antd/lib/upload';
import { RcFile, UploadFile } from 'antd/lib/upload/interface';
import axios from 'axios';
import { validate } from '@ideafast/idgen';
import dayjs from 'dayjs';
import Highlighter from 'react-highlight-words';
import { ResponsiveLine } from '@nivo/line';
import { ResponsiveBar } from '@nivo/bar';
import { useQueryClient } from '@tanstack/react-query';
const { Option } = Select;

export const FileRepositoryTabContent: FunctionComponent<{ study: IStudy }> = ({ study }) => {
    const whoAmI = trpc.user.whoAmI.useQuery();
    const getStudyConfig = trpc.config.getConfig.useQuery({ configType: enumConfigType.STUDYCONFIG, key: study.id, useDefault: true });
    const getStudyFields = trpc.data.getStudyFields.useQuery({ studyId: study.id });

    if (whoAmI.isLoading || getStudyConfig.isLoading || getStudyFields.isLoading) {
        return <>
            <div className='page_ariane'>Loading...</div>
            <div className='page_content'>
                <LoadSpinner />
            </div>
        </>;
    }

    if (whoAmI.isError || getStudyConfig.isError || getStudyFields.isError) {
        const errorMessage = (
            <div>
                <p>An error occurred:</p>
                {whoAmI.isError && <p>{`whoAmI error: ${whoAmI.error.message}`}</p>}
                {getStudyConfig.isError && <p>{`getStudyConfig error: ${getStudyConfig.error.message}`}</p>}
                {getStudyFields.isError && <p>{`getStudyFields error: ${getStudyFields.error.message}`}</p>}
            </div>
        );

        return <div>{errorMessage}</div>;
    }
    return <div className={css['tab_page_wrapper']}>
        <List
            header={
                <div className={css['overview-header']} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                        <div className={css['overview-icon']}></div>
                        <div>Description</div>
                    </div>
                </div>
            }
        >
            <List.Item>
                <Typography.Paragraph style={{ whiteSpace: 'pre-line' }}>
                    {study.description}
                </Typography.Paragraph>
            </List.Item>
        </List>
        {
            ((getStudyConfig.data.properties as IStudyConfig).defaultFileBlocks ?? []).map((block, index) => (
                <FileBlock
                    key={`Fileblock_${index}`}
                    user={whoAmI.data}
                    fields={getStudyFields.data}
                    study={study}
                    block={block}
                />
            ))
        }
    </div >;
};

export const UploadFileComponent: FunctionComponent<{ study: IStudy, fields: IField[], fieldIds: string[], setIsUploading: (isUploading: boolean) => void, setProgress: (progress: number) => void }> = ({ study, fields, fieldIds, setIsUploading, setProgress }) => {
    const queryClient = useQueryClient();
    const [__unused__api, contextHolder] = notification.useNotification();
    const [isShowPanel, setIsShowPanel] = React.useState(false);
    const [fileList, setFileList] = useState<RcFile[]>([]);
    const [fileProperties, setFileProperties] = useState({
        fieldId: ''
    });
    const getCurrentDomain = trpc.domain.getCurrentDomain.useQuery();
    const [form] = Form.useForm();
    let selectedField = fields.filter(el => el.fieldId === fileProperties.fieldId)[0];

    if (getCurrentDomain.isLoading) {
        return <LoadSpinner />;
    }

    if (getCurrentDomain.isError) {
        return <div>An error occured.</div>;
    }

    const handleUploadFile = async (variables: Record<string, string>) => {
        try {
            setIsShowPanel(false);
            setIsUploading(true);
            const formData = new FormData();

            // Append file
            if (fileList.length > 0) {
                formData.append('file', fileList[0]);
            }

            // Append additional fields
            formData.append('fieldId', String(variables.fieldId));
            formData.append('studyId', String(variables.studyId));
            formData.append('properties', JSON.stringify({
                ...variables,
                FileName: fileList[0]?.name || 'unknown'
            }));
            // Axios request
            const response = await axios.post('/trpc/data.uploadStudyFileData', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                },
                onUploadProgress: (progressEvent) => {
                    if (progressEvent.total) {
                        const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                        setProgress(percentCompleted);
                    }
                }
            });
            if (response?.data?.result?.data?.id) {
                const queryKey = [['data', 'getFiles'], {
                    input: {
                        studyId: study.id,
                        fieldIds: fieldIds,
                        useCache: false,
                        readable: true
                    }, type: 'query'
                }];
                const cache: IFile[] = queryClient.getQueryData(queryKey) ?? [];
                const newCache = [...cache, response.data.result.data];
                queryClient.setQueryData(queryKey, newCache);
                void queryClient.invalidateQueries(['data', 'getFiles', {
                    input: {
                        studyId: study.id,
                        fieldIds: fieldIds,
                        useCache: false,
                        readable: true
                    }
                }]);
                setIsUploading(false);
                setIsShowPanel(false);
                void message.success('File has been uploaded.');
            }

        } catch (error) {
            // Check if the error is an AxiosError and handle it accordingly
            if (axios.isAxiosError(error)) {
                void message.error(String(JSON.parse(error.request?.response).error.message));
            } else {
                // Handle non-Axios errors
                void message.error('An unexpected error occurred.');
            }
        } finally {
            setIsUploading(false);
            setProgress(0);
        }

    };
    return (<div>
        {contextHolder}
        <Button style={{ backgroundColor: 'powderblue' }} onClick={() => setIsShowPanel(true)}>Upload Files</Button>
        <Modal
            open={isShowPanel}
            onCancel={() => {
                setIsShowPanel(false);
                setFileList([...[]]);
            }}
            onOk={() => {
                void handleUploadFile({
                    ...form.getFieldsValue(),
                    studyId: study.id
                });
                setFileList([]);
                form.resetFields();
            }}
        >
            <Upload.Dragger
                key={fileList.length}
                multiple={false}
                showUploadList={true}
                beforeUpload={async () => {
                    return false;
                }}
                onChange={(info: UploadChangeParam<UploadFile>) => {
                    // Filter out any items that do not have originFileObj
                    const validFiles: RcFile[] = info.fileList
                        .map(item => item.originFileObj)
                        .filter((file): file is RcFile => !!file);
                    // We set a special case for IDEA-FAST project because the validator could not be merged into the new rules
                    if (getCurrentDomain.data?.name === 'IDEA-FAST' && study.description?.startsWith('IDEA-FAST')) {
                        try {
                            if (validFiles.length !== 1) {
                                return;
                            }
                            const fileName = validFiles[0].name;
                            const matcher = /(.{1})(.{6})-(.{3})(.{6})-(\d{8})-(\d{8})\.(.*)/;
                            const particules = fileName.match(matcher);
                            const properties: Record<string, string | number> = {};
                            if (!particules) {
                                return;
                            }
                            if (particules?.length === 8) {
                                if (validate(particules[2].toUpperCase()))
                                    properties.subjectId = `${particules[1].toUpperCase()}${particules[2].toUpperCase()}`;
                                if (validate(particules[4].toUpperCase()))
                                    properties.deviceId = `${particules[3].toUpperCase()}${particules[4].toUpperCase()}`;
                                const startDate = dayjs(particules[5], 'YYYYMMDD');
                                const endDate = dayjs(particules[6], 'YYYYMMDD');
                                if (startDate.isSame(endDate) || startDate.isBefore(endDate)) {
                                    if (startDate.isValid())
                                        properties.startDate = startDate.valueOf();
                                    if (endDate.isValid() && (endDate.isSame(dayjs()) || endDate.isBefore(dayjs())))
                                        properties.endDate = endDate.valueOf();
                                }
                            }
                            const fieldId = `Device_${deviceTypes[particules[3]].replace(/ /g, '_')}`;
                            form.setFieldsValue({
                                fieldId: fieldId,
                                subjectId: properties.subjectId,
                                deviceId: properties.deviceId,
                                startDate: properties.startDate,
                                endDate: properties.endDate
                            });
                            setFileProperties({
                                fieldId: fieldId
                            });
                            selectedField = fields.filter(el => el.fieldId === fieldId)[0];
                        } catch {
                            void message.error('Failed to upload file.');
                        }
                    }
                    setFileList(validFiles);
                }}
                onRemove={() => setFileList([])}
            >
                <p className="ant-upload-drag-icon">
                    <InboxOutlined style={{ color: '#009688', fontSize: 48 }} />
                </p>
                <p className="ant-upload-text" style={{ fontSize: 16, color: '#444' }}>
                    Drag files here or click to select files
                </p>
            </Upload.Dragger>
            <Form
                form={form}
                layout='horizontal'
            >
                <Form.Item
                    name="fieldId"
                    label="File Category"
                    rules={[{ required: true }]}
                    labelCol={{ span: 8 }}
                    wrapperCol={{ span: 16 }}
                >
                    <Select
                        placeholder='Select a file category'
                        allowClear
                        onChange={(value) => setFileProperties({ fieldId: value })}
                        filterOption={(input: string, option?: { label: string; value: string }) =>
                            (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
                        showSearch
                    >
                        {fields.map(el => <Option value={el.fieldId} label={el.fieldId}>{el.fieldName}</Option>)}
                    </Select>
                </Form.Item>
                {
                    (selectedField && selectedField.properties) ? selectedField.properties.filter(el => el.name !== 'FileName').map(el =>
                        <Form.Item
                            key={el.name}
                            name={el.name}
                            label={el.name}
                            rules={[{ required: el.required }]}
                            labelCol={{ span: 8 }}
                            wrapperCol={{ span: 16 }}
                        >
                            <Input />
                        </Form.Item>
                    )
                        : null
                }
            </Form>
        </Modal>
    </div >);
};

export const FileBlock: FunctionComponent<{ user: IUserWithoutToken, fields: IField[], study: IStudy, block: IStudyFileBlock }> = ({ user, fields, study, block }) => {
    const [isUploading, setIsUploading] = useState(false);
    const queryClient = useQueryClient();
    const [progress, setProgress] = useState(0);
    const [searchedKeyword, setSearchedKeyword] = useState<string | undefined>(undefined);
    const [isModalOn, setIsModalOn] = useState(false);
    const getFiles = trpc.data.getFiles.useQuery({ studyId: study.id, fieldIds: block.fieldIds, readable: true, useCache: false });
    const deleteFile = trpc.data.deleteFile.useMutation({
        onSuccess: (data) => {
            const queryKey = [['data', 'getFiles'], {
                input: {
                    studyId: study.id,
                    fieldIds: fields.map(el => el.fieldId),
                    useCache: false,
                    readable: true
                }, type: 'query'
            }];
            const cache: IFile[] = queryClient.getQueryData(queryKey) ?? [];
            const newCache = cache.filter(el => el.id !== data.id);
            queryClient.setQueryData(queryKey, newCache);
            void queryClient.invalidateQueries(['data', 'getFiles', {
                input: {
                    studyId: study.id,
                    fieldIds: fields.map(el => el.fieldId),
                    useCache: false,
                    readable: true
                }
            }]);
            void message.success('File has been deleted.');
        },
        onError: () => {
            void message.error('Failed to delete file.');
        }
    });
    if (getFiles.isLoading) {
        return <LoadSpinner />;
    }
    if (getFiles.isError) {
        return <div>An error occured.</div>;
    }

    const columns = generateTableColumns(block, searchedKeyword);
    if (user.type === enumUserTypes.ADMIN) {
        columns.push({
            title: '',
            dataIndex: 'delete',
            key: 'delete',
            render: (__unused__value, record) => {
                return <Button danger onClick={() => deleteFile.mutate({ fileId: record.id })}>Delete</Button>;
            }
        });
    }

    const filteredFiles = getFiles.data.filter(el => {
        if (!searchedKeyword) {
            return true;
        } else {
            const keyword = searchedKeyword.toLowerCase();
            if (
                el.fileName?.toLowerCase().includes(keyword) ||
                el.life?.createdUser?.toLowerCase().includes(keyword) ||
                Object.keys(el.properties ?? {}).some(key => String(el.properties?.[key]).toLowerCase().includes(keyword))
            ) {
                return true;
            }
            return false;
        }
    }).sort((a, b) => (b.life?.createdTime ?? 0) - (a.life?.createdTime ?? 0));

    const summaryByMonth = (filteredFiles) => {
        // Create a map to hold the counts per month
        const fileCounts: { [key: string]: number } = {};

        // Iterate over each file and extract the createdTime
        filteredFiles.forEach(file => {
            if (file.life?.createdTime) {
                // Convert createdTime (Unix timestamp) to a JavaScript Date object
                const createdDate = new Date(file.life.createdTime);

                // Format the date as 'YYYY-MM' for the month
                const month = `${createdDate.getFullYear()}-${String(createdDate.getMonth() + 1).padStart(2, '0')}`;

                // Increment the count for the corresponding month
                if (fileCounts[month]) {
                    fileCounts[month]++;
                } else {
                    fileCounts[month] = 1;
                }
            }
        });

        // Convert the map into an array of {x: month, y: count} objects
        const result = Object.keys(fileCounts).map(month => ({
            x: month,
            y: fileCounts[month]
        }));

        // Sort the result array by the 'x' (month) value
        result.sort((a, b) => {
            const dateA = new Date(a.x + '-01'); // Adding '-01' to treat it as a full date (YYYY-MM-DD)
            const dateB = new Date(b.x + '-01');
            return dateA.getTime() - dateB.getTime();
        });
        // Return in the expected format
        return [{
            id: 'Month',
            color: 'hsl(127, 70%, 50%)',
            data: result
        }];
    };

    const summaryByUser = (filteredFiles) => {
        // Create a map to hold the counts per user
        const userCounts: { [key: string]: number } = {};

        // Iterate over each file and extract the createdUser
        filteredFiles.forEach(file => {
            const createdUser = file.life?.createdUser || 'Unknown User'; // Fallback to 'Unknown User' if createdUser is null/undefined

            // Increment the count for the corresponding user
            if (userCounts[createdUser]) {
                userCounts[createdUser]++;
            } else {
                userCounts[createdUser] = 1;
            }
        });

        // Convert the map into an array of {x: user, y: count} objects
        const result = Object.keys(userCounts).map(user => ({
            user: user.split(' ').map(el => (el[0] ?? '').toUpperCase()).join(''),
            userFullName: user,
            files: userCounts[user]
        }));

        // Sort the result array by the 'y' (count) value in descending order
        result.sort((a, b) => a.user.localeCompare(b.user));

        // Return in the expected format
        return result;
    };

    return <List
        header={
            <div className={css['overview-header']} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                    <div className={css['overview-icon']}></div>
                    <div>{block.title}</div>
                </div>
                <div>
                    <UploadFileComponent study={study} fields={fields.filter(el => el.dataType === enumDataTypes.FILE)} fieldIds={block.fieldIds} setIsUploading={setIsUploading} setProgress={setProgress} />
                </div>
            </div>
        }
    >
        <List.Item>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                <div style={{ width: '50%' }}>
                    <Input
                        value={searchedKeyword}
                        placeholder="Search"
                        onChange={(e) => setSearchedKeyword(e.target.value)}
                    />
                </div>
                <div style={{ width: '20%', textAlign: 'right' }}>
                    {
                        isUploading ? (
                            <div
                                style={{
                                    position: 'absolute',
                                    top: '2%',
                                    right: '25%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    transform: 'translate(-50%, -50%)'
                                }}
                            >
                                <Progress type='circle' size={60} percent={Math.min(progress, 99)} />
                                <span style={{ fontSize: '20px', fontWeight: 'bold', color: 'black', marginRight: '20px' }}>{progress >= 99 ? 'Finishing' : 'Uploading'}</span>
                            </div>
                        ) : null
                    }
                </div>
                <div style={{ width: '30%', textAlign: 'right' }}>
                    <span style={{ fontSize: '16px', fontWeight: 'bold', color: 'black', marginRight: '20px' }}>
                        {`Files: ${filteredFiles.length}`}
                    </span>
                    <span style={{ fontSize: '16px', fontWeight: 'bold', color: 'black', marginRight: '20px' }}>
                        {`Size: ${formatBytes(filteredFiles.reduce((acc, curr) => acc + (Number(curr?.fileSize) || 0), 0))}`}
                    </span>
                    <Button onClick={() => setIsModalOn(true)}>Statistics</Button>
                </div>
            </div>
            <Modal
                open={isModalOn}
                onCancel={() => setIsModalOn(false)}
                footer={null}
                width='80%'
            >
                <h2>Progress by Month</h2>
                <div style={{ height: '300px' }}>
                    <ResponsiveLine
                        data={summaryByMonth(filteredFiles)}
                        margin={{ top: 50, right: 110, bottom: 50, left: 60 }}
                        xScale={{ type: 'point' }}
                        yScale={{
                            type: 'linear',
                            min: 'auto',
                            max: 'auto',
                            stacked: true,
                            reverse: false
                        }}
                        yFormat=" >-.2f"
                        axisTop={null}
                        axisRight={null}
                        axisBottom={{
                            tickSize: 5,
                            tickPadding: 5,
                            tickRotation: 0,
                            legend: 'Month',
                            legendOffset: 36,
                            legendPosition: 'middle',
                            truncateTickAt: 0
                        }}
                        axisLeft={{
                            tickSize: 5,
                            tickPadding: 5,
                            tickRotation: 0,
                            legend: 'Files Uploaded',
                            legendOffset: -40,
                            legendPosition: 'middle',
                            truncateTickAt: 0
                        }}
                        pointSize={10}
                        pointColor={{ theme: 'background' }}
                        pointBorderWidth={2}
                        pointBorderColor={{ from: 'serieColor' }}
                        pointLabel="data.yFormatted"
                        pointLabelYOffset={-12}
                        enableTouchCrosshair={true}
                        useMesh={true}
                        legends={[
                            {
                                anchor: 'bottom-right',
                                direction: 'column',
                                justify: false,
                                translateX: 100,
                                translateY: 0,
                                itemsSpacing: 0,
                                itemDirection: 'left-to-right',
                                itemWidth: 80,
                                itemHeight: 20,
                                itemOpacity: 0.75,
                                symbolSize: 12,
                                symbolShape: 'circle',
                                symbolBorderColor: 'rgba(0, 0, 0, .5)',
                                effects: [
                                    {
                                        on: 'hover',
                                        style: {
                                            itemBackground: 'rgba(0, 0, 0, .03)',
                                            itemOpacity: 1
                                        }
                                    }
                                ]
                            }
                        ]}
                    />
                </div>
                <h2>Progress by Uploaders</h2>
                <div style={{ height: '400px' }}>
                    <ResponsiveBar
                        data={summaryByUser(filteredFiles)}
                        keys={[
                            'files'
                        ]}
                        indexBy="user"
                        margin={{ top: 50, right: 130, bottom: 50, left: 60 }}
                        padding={0.3}
                        valueScale={{ type: 'linear' }}
                        indexScale={{ type: 'band', round: true }}
                        colors={{ scheme: 'nivo' }}
                        defs={[
                            {
                                id: 'dots',
                                type: 'patternDots',
                                background: 'inherit',
                                color: '#38bcb2',
                                size: 4,
                                padding: 1,
                                stagger: true
                            },
                            {
                                id: 'lines',
                                type: 'patternLines',
                                background: 'inherit',
                                color: '#eed312',
                                rotation: -45,
                                lineWidth: 6,
                                spacing: 10
                            }
                        ]}
                        fill={[
                            {
                                match: {
                                    id: 'fries'
                                },
                                id: 'dots'
                            },
                            {
                                match: {
                                    id: 'sandwich'
                                },
                                id: 'lines'
                            }
                        ]}
                        borderColor={{
                            from: 'color',
                            modifiers: [
                                [
                                    'darker',
                                    1.6
                                ]
                            ]
                        }}
                        axisTop={null}
                        axisRight={null}
                        axisBottom={(() => {
                            return {
                                tickSize: 10,
                                tickPadding: 0,
                                tickRotation: -90,
                                legend: 'User',
                                legendPosition: 'middle',
                                legendOffset: 32,
                                truncateTickAt: 0
                            };
                        })()}
                        axisLeft={{
                            tickSize: 5,
                            tickPadding: 5,
                            tickRotation: 0,
                            legend: 'Files',
                            legendPosition: 'middle',
                            legendOffset: -40,
                            truncateTickAt: 0
                        }}
                        labelSkipWidth={12}
                        labelSkipHeight={12}
                        labelTextColor={{
                            from: 'color',
                            modifiers: [
                                [
                                    'darker',
                                    1.6
                                ]
                            ]
                        }}
                        legends={[
                            {
                                dataFrom: 'keys',
                                anchor: 'bottom-right',
                                direction: 'column',
                                justify: false,
                                translateX: 120,
                                translateY: 0,
                                itemsSpacing: 2,
                                itemWidth: 100,
                                itemHeight: 20,
                                itemDirection: 'left-to-right',
                                itemOpacity: 0.85,
                                symbolSize: 20,
                                effects: [
                                    {
                                        on: 'hover',
                                        style: {
                                            itemOpacity: 1
                                        }
                                    }
                                ]
                            }
                        ]}
                        tooltip={(d) => `${d.data.userFullName}: ${d.data.files} files`}
                        role="application"
                        ariaLabel="Nivo bar chart demo"
                        barAriaLabel={e => e.id + ': ' + e.formattedValue + ' in country: ' + e.indexValue}
                    />
                </div><br />
                <h2>Statistics by Group</h2>
                <div>
                    <Select
                        placeholder='Select the grouping keys in order'
                        style={{ width: '100%' }}
                        mode='multiple'
                    >
                        {
                            block.defaultFileColumns.map(el => (
                                <Option value={el.property}>{el.title}</Option>
                            ))
                        }
                    </Select>
                </div>
            </Modal>
        </List.Item>
        <List.Item>
            <div style={{ fontSize: '20px', width: '100%' }}>
                <Table
                    columns={columns}
                    expandable={{ showExpandColumn: false }}
                    dataSource={filteredFiles}
                />
            </div>
        </List.Item>
    </List>;
};

type CustomColumnType = {
    title: React.ReactNode;
    dataIndex: string;
    key: string;
    sorter?: (a, b) => number;
    render?: (value, record) => React.ReactNode;
};

function generateTableColumns(block: IStudyFileBlock, searchedKeyword: string | undefined) {
    const columns: CustomColumnType[] = [{
        title: 'File Name',
        dataIndex: 'fileName',
        key: 'fileName',
        sorter: (a, b) => { return stringCompareFunc(a.fileName, b.fileName); },
        render: (__unused__value, record) => {
            if (searchedKeyword)
                return <Highlighter searchWords={[searchedKeyword]} textToHighlight={record.fileName} highlightStyle={{
                    backgroundColor: '#FFC733',
                    padding: 0
                }} />;
            else
                return record.fileName;
        }
    }, {
        title: 'File Size',
        dataIndex: 'fileSize',
        key: 'fileSize',
        sorter: (a, b) => { return a.fileSize - b.fileSize; },
        render: (__unused__value, record) => {
            return formatBytes(record.fileSize);
        }
    }, {
        title: 'Uploaded Time',
        dataIndex: 'uploadedTime',
        key: 'uploadedTime',
        sorter: (a, b) => { return (new Date(a.life.createdTime)).valueOf() - (new Date(b.life.createdTime)).valueOf(); },
        render: (__unused__value, record) => {
            return (new Date(record.life.createdTime)).toLocaleDateString();
        }
    }, {
        title: 'Uploaded By',
        dataIndex: 'uploadedBy',
        key: 'uploadedBy',
        render: (__unused__value, record) => {
            if (searchedKeyword)
                return <Highlighter searchWords={[searchedKeyword]} textToHighlight={record.life.createdUser} highlightStyle={{
                    backgroundColor: '#FFC733',
                    padding: 0
                }} />;
            else
                return record.life.createdUser;
        }
    }];
    for (const bcolumn of block.defaultFileColumns) {
        columns.push({
            title: <span style={{ color: 'black' }}>{bcolumn.title}</span>,
            dataIndex: bcolumn.property,
            key: bcolumn.property,
            sorter: (a, b) => {
                if (bcolumn.type === enumStudyBlockColumnValueType.TIME) {
                    return (new Date(tableColumnRender(a, bcolumn))).valueOf() - (new Date(tableColumnRender(b, bcolumn))).valueOf();
                }
                return stringCompareFunc(tableColumnRender(a, bcolumn), tableColumnRender(b, bcolumn));
            },
            render: (__unused__value, record) => {
                const formattedText = tableColumnRender(record, bcolumn);
                if (searchedKeyword)
                    return <Highlighter searchWords={[searchedKeyword]} textToHighlight={formattedText} highlightStyle={{
                        backgroundColor: '#FFC733',
                        padding: 0
                    }} />;
                else
                    return formattedText;
            }
        });
    }
    columns.push({
        title: '',
        dataIndex: 'hash',
        render: (__unused__value, record) => (
            <Tooltip title={record.hash} placement='bottomRight' >
                <Button type='link' icon={<NumberOutlined />}></Button>
            </Tooltip>
        ),
        // width: '8rem',
        key: 'delete'
    });
    columns.push({
        title: '',
        dataIndex: 'download',
        key: 'download',
        render: (__unused__value, record) => {
            return <Button
                icon={<CloudDownloadOutlined />}
                download={`${record.fileName}`}
                href={`/file/${record.id}`}>
                Download
            </Button>;
        }
    });

    return columns;
}

