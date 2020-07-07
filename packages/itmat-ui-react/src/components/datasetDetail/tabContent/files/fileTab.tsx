import React, { useState, useEffect, useRef, useContext } from 'react';
import { Button, Upload, notification, Tag, Table, Form, Input, DatePicker } from 'antd';
import { RcFile } from 'antd/lib/upload';
import { UploadOutlined, DeleteOutlined } from '@ant-design/icons';
import { Query, useApolloClient, useMutation } from 'react-apollo';
import { useDropzone } from 'react-dropzone';
import { GET_STUDY, UPLOAD_FILE } from 'itmat-commons';
import { FileList } from '../../../reusable/fileList/fileList';
import LoadSpinner from '../../../reusable/loadSpinner';
import { Subsection } from '../../../reusable/subsection/subsection';
import css from './tabContent.module.css';
import { ApolloError } from 'apollo-client';
import { validate } from '@ideafast/idgen';
import moment, { Moment } from 'moment';
import { v4 as uuid } from 'uuid';

type StudyFile = RcFile & {
    uuid: string;
    participantId?: string;
    deviceId?: string;
    startDate?: Moment;
    endDate?: Moment;
}

export const sites = {
    I: 'Imperial College London',
    N: 'Newcastle',
    K: 'Kiel',
    G: 'GHI Muenster',
    E: 'EMC Rotterdam'
};

export const deviceTypes = {
    AX6: 'Axivity',
    BVN: 'Biovotion',
    BTF: 'Byteflies',
    MMM: 'McRoberts',
    DRM: 'Dreem',
    VTP: 'VitalPatch',
    BED: 'VTT Bed Sensor',
    YSM: 'ZKOne',
    MBT: 'Mbient',
};

const { RangePicker } = DatePicker;

export const FileRepositoryTabContent: React.FunctionComponent<{ studyId: string }> = ({ studyId }) => {

    const [isDropOverlayShowing, setisDropOverlayShowing] = useState(false);
    const [fileList, setFileList] = useState<StudyFile[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const store = useApolloClient();

    // let { loading, progress, error } = useUpload(files, {
    //     mutation: UPLOAD_FILE,
    //     variables: { input: { files, name: 'test' } },
    // });

    const [uploadFile] = useMutation(UPLOAD_FILE, {
        onCompleted: ({ uploadFile }) => {
            const cachedata = store.readQuery({
                query: GET_STUDY,
                variables: { studyId }
            }) as any;
            if (!cachedata)
                return;
            const newcachedata = {
                ...cachedata.getStudy,
                files: [...cachedata.getStudy.files, uploadFile]
            };
            store.writeQuery({
                query: GET_STUDY,
                variables: { studyId },
                data: { getStudy: newcachedata }
            });
        },
        onError: (error: ApolloError) => {
            notification.error({
                message: 'Upload error!',
                description: error.message ?? 'Unknown Error Occurred!',
                placement: 'topRight',
                duration: 0,
            });
        }
    });

    const onDropLocal = (acceptedFiles: Blob[]) => {
        fileFilter(acceptedFiles.map(file => {
            return file as StudyFile;
        }));
    };

    const onDragEnter = () => setisDropOverlayShowing(true);
    const onDragOver = () => setisDropOverlayShowing(true);
    const onDragLeave = () => setisDropOverlayShowing(false);
    const onDropAccepted = () => setisDropOverlayShowing(false);
    const onDropRejected = () => setisDropOverlayShowing(false);

    const { getRootProps, getInputProps } = useDropzone({
        noClick: true,
        preventDropOnDocument: true,
        noKeyboard: true,
        onDrop: onDropLocal,
        onDragEnter,
        onDragOver,
        onDragLeave,
        onDropAccepted,
        onDropRejected
    });

    const removeFile = (record: StudyFile): void => {
        setFileList(fileList => {
            const index = fileList.findIndex(file => file.uuid === record.uuid);
            const newFileList = [...fileList];
            newFileList.splice(index, 1);
            return newFileList;
        });
    };

    const fileFilter = (files: StudyFile[]) => {
        files.forEach((file) => {
            const matcher = /(.{1})(.{6})-(.{3})(.{6})-(\d{8})-(\d{8})\.(.*)/;
            const particules = file.name.match(matcher);
            if (particules?.length === 8) {
                if (Object.keys(sites).includes(particules[1].toUpperCase())
                    && validate(particules[2].toUpperCase()))
                    file.participantId = `${particules[1].toUpperCase()}${particules[2].toUpperCase()}`;
                if (Object.keys(deviceTypes).includes(particules[3].toUpperCase())
                    && validate(particules[4].toUpperCase()))
                    file.deviceId = `${particules[3].toUpperCase()}${particules[4].toUpperCase()}`;
                file.startDate = moment(particules[5], 'YYYYMMDD');
                file.endDate = moment(particules[6], 'YYYYMMDD');
            }
            file.uuid = uuid();
            fileList.push(file);
        });
        setFileList([...fileList]);
    };

    const validFile = fileList.filter((file) => file.deviceId && file.participantId && file.startDate && file.endDate);
    const uploadHandler = () => {

        const uploads: Promise<any>[] = [];
        setIsUploading(true);
        validFile.forEach(file => {
            uploads.push(uploadFile({
                variables: {
                    file,
                    studyId,
                    description: JSON.stringify({
                        participantId: file.participantId?.trim().toUpperCase(),
                        deviceId: file.deviceId?.trim().toUpperCase(),
                        startDate: file.startDate?.toISOString(),
                        endDate: file.endDate?.toISOString(),
                    }),
                    fileLength: file.size
                }
            }).then(result => {
                removeFile(file);
                notification.success({
                    message: 'Upload succeeded!',
                    description: `File ${result.data.uploadFile.fileName} was successfully uploaded!`,
                    placement: 'topRight',
                });
            }).catch(error => {
                notification.error({
                    message: 'Upload error!',
                    description: error?.message ?? error ?? 'Unknown Error Occurred!',
                    placement: 'topRight',
                    duration: 0,
                });
            }));
        });

        Promise.all(uploads).then(() => {
            setIsUploading(false);
        });
    };

    const uploaderProps = {
        onRemove: (file) => {
            const target = fileList.indexOf(file);
            setFileList(fileList.splice(0, target).concat(fileList.splice(target + 1)));
        },
        beforeUpload: (file) => {
            fileFilter([file]);
            return true;
        },
        fileList,
        multiple: true,
        showUploadList: false
    };

    const handleSave = record => {
        setFileList(fileList => {
            const index = fileList.findIndex(file => file.uuid === record.uuid);
            const newFileList = [...fileList];
            const newFile = fileList[index];
            newFile.participantId = record.participantId;
            newFile.deviceId = record.deviceId;
            newFile.startDate = record.startDate;
            newFile.endDate = record.endDate;
            newFileList.splice(index, 1, newFile);
            return newFileList;
        });
    };

    const columns = [
        {
            title: 'File name',
            dataIndex: 'name',
            key: 'fileName',
            sorter: (a, b) => a.fileName.localeCompare(b.fileName)
        },
        {
            title: 'Participant ID',
            dataIndex: 'participantId',
            key: 'pid',
            editable: true,
            width: '10rem'
        },
        {
            title: 'Site',
            dataIndex: 'siteId',
            key: 'site',
            render: (__unused__value, record) => record.participantId ? sites[record.participantId.substr(0, 1)] : null
        },
        {
            title: 'Device ID',
            dataIndex: 'deviceId',
            key: 'did',
            editable: true,
            width: '12rem'
        },
        {
            title: 'Device type',
            dataIndex: 'deviceType',
            key: 'stype',
            render: (__unused__value, record) => record.deviceId ? deviceTypes[record.deviceId.substr(0, 3)] : null
        },
        {
            title: 'Period',
            dataIndex: 'period',
            key: 'period',
            editable: true,
            width: '24rem'
        },
        {
            key: 'delete',
            render: (__unused__value, record) => <Button disabled={isUploading} type='primary' danger icon={<DeleteOutlined />} onClick={() => {
                removeFile(record);
            }}></Button>
        }]
        .map(col => {
            if (!col.editable) {
                return col;
            }
            return {
                ...col,
                onCell: record => ({
                    record: {
                        ...record,
                        period: [record.startDate, record.endDate]
                    },
                    editable: col.editable,
                    dataIndex: col.dataIndex,
                    title: col.title,
                    handleSave
                }),
            };
        });

    return <div {...getRootProps()} className={`${css.scaffold_wrapper} ${isDropOverlayShowing ? css.drop_overlay : ''}`}>
        <input {...getInputProps()} />

        {fileList.length > 0
            ?
            <div className={`${css.tab_page_wrapper} ${css.both_panel} ${css.upload_overlay}`}>
                <Subsection title='Upload files'>
                    <Upload {...uploaderProps}>
                        <Button>Select more files</Button>
                    </Upload>
                    <br />
                    <br />
                    <Table
                        rowKey={(rec) => rec.uuid}
                        rowClassName={() => css.editable_row}
                        pagination={false}
                        columns={columns}
                        dataSource={fileList}
                        size='small'
                        components={{ body: { row: EditableRow, cell: EditableCell } }} />
                    <Button
                        icon={<UploadOutlined />}
                        type='primary'
                        onClick={uploadHandler}
                        disabled={fileList.length === 0}
                        loading={isUploading}
                        style={{ marginTop: 16 }}
                    >
                        {isUploading ? `Uploading (${validFile.length} ready of ${fileList.length})` : `Upload (${validFile.length} ready of ${fileList.length})`}
                    </Button>
                    &nbsp;&nbsp;&nbsp;
                    <Button onClick={() => setFileList([])}>Cancel</Button>
                </Subsection>
            </div>
            : <div className={`${css.tab_page_wrapper} ${css.both_panel} fade_in`}>
                <Subsection title='Upload files'>
                    To upload file to IDEA-FAST you can click on the button below or drag and drop files directly from your hard drive.<br />
                    If the file name is of the form <Tag style={{ fontFamily: 'monospace' }}>XAAAAAA-DDDBBBBBB-00000000-00000000.EXT</Tag>we will extract metadata automatically. If not, you will be prompted to enter the relevant information.<br /><br />
                    <Upload  {...uploaderProps}>
                        <Button>Select files</Button>
                    </Upload>
                    <br />
                    <br />
                    <br />
                </Subsection>
                <Subsection title='Existing files'>
                    <Query<any, any> query={GET_STUDY} variables={{ studyId }}>
                        {({ loading, data, error }) => {
                            if (loading) { return <LoadSpinner />; }
                            if (error) { return <p>{error.toString()}</p>; }
                            if (!data.getStudy || !data.getStudy.files || data.getStudy.files.length === 0) {
                                return <p>There seems to be no files for this study. You can start uploading files.</p>;
                            }
                            return <FileList files={data.getStudy.files} />;
                        }}
                    </Query>
                </Subsection>
            </div>}
    </div>;
};

const EditableContext = React.createContext<any>({});

type EditableRowProps = {
    index: number;
}

const EditableRow: React.FC<EditableRowProps> = ({ index: __unused__index, ...props }) => {
    const [form] = Form.useForm();

    useEffect(() => {
        form.validateFields();
    });

    return (
        <Form form={form} component={false}>
            <EditableContext.Provider value={form}>
                <tr {...props} />
            </EditableContext.Provider>
        </Form>
    );
};

interface EditableCellProps {
    editable: boolean;
    children: React.ReactNode;
    dataIndex: string;
    record: StudyFile;
    handleSave: (record: StudyFile) => void;
}

const EditableCell: React.FC<EditableCellProps> = ({
    editable,
    children,
    dataIndex,
    record,
    handleSave,
    ...restProps
}) => {
    const [editing, setEditing] = useState(false);
    const inputRef = useRef<Input>(null);
    const rangeRef = useRef<any>(null);
    const form = useContext(EditableContext);

    useEffect(() => {
        if (editable && !editing) {
            form.setFieldsValue(record);
            setEditing(true);
        }
    }, [editable, editing, form, record]);

    const save = async () => {
        try {
            const values = await form.validateFields();
            handleSave({ ...record, ...values });
        } catch (errInfo) {
            // console.error(errInfo);
        }
    };

    let childNode = children;

    if (editing) {
        if (dataIndex === 'period') {
            childNode = <>
                <Form.Item
                    style={{ display: 'none' }}
                    name='startDate'
                    rules={[{ required: true, message: <></> }]}
                >
                    <Input id={`startDate_${record.uuid}`} />
                </Form.Item>
                <Form.Item
                    style={{ display: 'none' }}
                    name='endDate'
                    rules={[{ required: true, message: <></> }]}
                >
                    <Input id={`endDate_${record.uuid}`} />
                </Form.Item>
                <Form.Item
                    style={{ margin: 0 }}
                    name='period'
                    hasFeedback
                    dependencies={['startDate', 'endDate']}
                    rules={[
                        { required: true, message: <></> },
                        ({ getFieldValue }) => ({
                            validator() {
                                if (getFieldValue('startDate') && getFieldValue('endDate'))
                                    return Promise.resolve();
                                return Promise.reject('Missing dates');
                            },
                        })
                    ]}
                >
                    <RangePicker id={`period_${record.uuid}`} allowClear={false} ref={rangeRef} defaultValue={[record.startDate ?? null, record.endDate ?? null]} onCalendarChange={(dates) => {
                        if (dates === null)
                            return;
                        form.setFieldsValue({ startDate: dates[0] });
                        form.setFieldsValue({ endDate: dates[1] });
                    }} onBlur={save} />
                </Form.Item>
            </>;
        } else {
            childNode = <Form.Item
                style={{ margin: 0 }}
                name={dataIndex}
                hasFeedback
                rules={[{
                    required: true, message: <></>, validator: (__unused__rule, value) => {
                        if (dataIndex === 'participantId') {
                            if (!Object.keys(sites).includes(value?.[0]))
                                throw new Error('Invalid site marker');
                            if (value.length === 7) {
                                if (!validate(value?.substr(1).toUpperCase()))
                                    throw new Error('Invalid participant ID');
                                return Promise.resolve();
                            }
                        }
                        if (dataIndex === 'deviceId') {
                            if (!Object.keys(deviceTypes).includes(value?.substr(0, 3)))
                                throw new Error('Invalid device marker');
                            if (value.length === 9) {
                                if (!validate(value?.substr(3).toUpperCase()))
                                    throw new Error('Invalid device ID');
                                return Promise.resolve();
                            }
                        }
                    }
                }]}
            >
                <Input id={`${dataIndex}_${record.uuid}`} ref={inputRef} allowClear={false} onPressEnter={save} onBlur={save} style={{ width: '100%' }} />
            </Form.Item>;
        }
    }

    return <td {...restProps}>{childNode}</td>;
};
