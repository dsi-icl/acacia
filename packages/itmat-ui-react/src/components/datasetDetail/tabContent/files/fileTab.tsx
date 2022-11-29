import { FunctionComponent, useState, useEffect, useRef, useContext, Fragment, HTMLAttributes, createContext, ReactNode } from 'react';
import { Button, Upload, notification, Tag, Table, Form, Input, InputRef, DatePicker, Space, Modal } from 'antd';
import { RcFile } from 'antd/es/upload';
import { UploadOutlined, DeleteOutlined } from '@ant-design/icons';
import { Query } from '@apollo/client/react/components';
import { useApolloClient, useMutation, useQuery } from '@apollo/client/react/hooks';
import { useDropzone } from 'react-dropzone';
import { GET_STUDY, UPLOAD_FILE, GET_ORGANISATIONS, GET_USERS, EDIT_STUDY, WHO_AM_I } from '@itmat-broker/itmat-models';
import { IFile, userTypes, studyType } from '@itmat-broker/itmat-types';
import { FileList, formatBytes } from '../../../reusable/fileList/fileList';
import LoadSpinner from '../../../reusable/loadSpinner';
import { Subsection, SubsectionWithComment } from '../../../reusable/subsection/subsection';
import css from './tabContent.module.css';
import { ApolloError } from '@apollo/client/errors';
import { validate } from '@ideafast/idgen';
import dayjs, { Dayjs } from 'dayjs';
import { v4 as uuid } from 'uuid';

type StudyFile = RcFile & {
    uuid: string;
    participantId?: string;
    deviceId?: string;
    startDate?: Dayjs;
    endDate?: Dayjs;
}

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
    IDE: 'German Interview Transcripts',
    IEN: 'English Interview Transcripts',
    INL: 'Dutch Interview Transcripts',
    TEQ: 'Technology Experience Questionnaire',
    PSG: 'PSG Study Polysomnography Data',
    PSR: 'PSG raw data',
    PSM: 'PSG meta data',
    SMA: 'Stress Monitor App',
    TFA: 'ThinkFast App',
    SMQ: 'Stress Monitor App Questionnaire',
    VIR: 'Virtual device type',
    CAN: 'Cantab App',
    WLD: 'Wildkey App'
};

const { RangePicker } = DatePicker;
let progressReports: any[] = [];

export const FileRepositoryTabContent: FunctionComponent<{ studyId: string }> = ({ studyId }) => {

    const [uploadMovement, setUploadMovement] = useState(0);
    const [isDropOverlayShowing, setisDropOverlayShowing] = useState(false);
    const [fileList, setFileList] = useState<StudyFile[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const store = useApolloClient();
    const { loading: getOrgsLoading, error: getOrgsError, data: getOrgsData } = useQuery(GET_ORGANISATIONS);
    const { loading: getStudyLoading, error: getStudyError, data: getStudyData } = useQuery(GET_STUDY, { variables: { studyId: studyId } });
    const { loading: getUsersLoading, error: getUsersError, data: getUsersData } = useQuery(GET_USERS, { variables: { fetchDetailsAdminOnly: false, fetchAccessPrivileges: false } });
    const { loading: whoAmILoading, error: whoAmIError, data: whoAmIData } = useQuery(WHO_AM_I);
    const [searchTerm, setSearchTerm] = useState('');
    const [isEditingDescription, setIsEditingDescription] = useState(false);
    const [datasetDescription, setDatasetDescription] = useState('');
    const [isFileSummaryShown, setIsFileSummaryShown] = useState(false);
    const [editStudy] = useMutation(EDIT_STUDY, {
        onCompleted: () => { window.location.reload(); },
        onError: () => { return; }
    });
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
                duration: 0
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
            if (getStudyData.getStudy.type === undefined || getStudyData.getStudy.type === null || getStudyData.getStudy.type === studyType.SENSOR) {
                const matcher = /(.{1})(.{6})-(.{3})(.{6})-(\d{8})-(\d{8})\.(.*)/;
                const particules = file.name.match(matcher);
                if (particules?.length === 8) {
                    if (Object.keys(sites).includes(particules[1].toUpperCase())
                        && validate(particules[2].toUpperCase()))
                        file.participantId = `${particules[1].toUpperCase()}${particules[2].toUpperCase()}`;
                    if (Object.keys(deviceTypes).includes(particules[3].toUpperCase())
                        && validate(particules[4].toUpperCase()))
                        file.deviceId = `${particules[3].toUpperCase()}${particules[4].toUpperCase()}`;
                    const startDate = dayjs(particules[5], 'YYYYMMDD');
                    const endDate = dayjs(particules[6], 'YYYYMMDD');
                    if (startDate.isSame(endDate) || startDate.isBefore(endDate)) {
                        if (startDate.isValid())
                            file.startDate = startDate;
                        if (endDate.isValid() && (endDate.isSame(dayjs()) || endDate.isBefore(dayjs())))
                            file.endDate = endDate;
                    }
                }
                progressReports[`UP_${file.participantId}_${file.deviceId}_${file.startDate?.valueOf()}_${file.endDate?.valueOf()}`] = undefined;
            } else if (getStudyData.getStudy.type === studyType.CLINICAL || getStudyData.getStudy.type === studyType.ANY) {
                progressReports[`UP_${file.name}`] = undefined;
            }
            file.uuid = uuid();
            fileList.push(file);
        });
        setFileList([...fileList]);
    };
    const validFile = (getStudyData.getStudy.type === undefined || getStudyData.getStudy.type === null || getStudyData.getStudy.type === studyType.SENSOR) ? fileList.filter((file) => file.deviceId && file.participantId && file.startDate && file.endDate)
        : fileList.filter((file) => file.name);
    const uploadHandler = () => {

        const uploads: Promise<any>[] = [];
        setIsUploading(true);
        validFile.forEach(file => {
            let description: any;
            let uploadMapHackName: any;
            if (getStudyData.getStudy.type === undefined || getStudyData.getStudy.type === null || getStudyData.getStudy.type === studyType.SENSOR) {
                description = {
                    participantId: file.participantId?.trim().toUpperCase(),
                    deviceId: file.deviceId?.trim().toUpperCase(),
                    startDate: file.startDate?.valueOf(),
                    endDate: file.endDate?.valueOf()
                };
                uploadMapHackName = `UP_${description.participantId}_${description.deviceId}_${description.startDate}_${description.endDate}`;
            } else {
                description = {};
                uploadMapHackName = `UP_${file.name}`;
            }
            if (!(window as any).onUploadProgressHackMap)
                (window as any).onUploadProgressHackMap = {};
            (window as any).onUploadProgressHackMap[uploadMapHackName] = (progressEvent) => {
                setUploadMovement(Math.random);
                progressReports = {
                    ...progressReports,
                    [uploadMapHackName]: progressEvent
                };
            };
            uploads.push(uploadFile({
                variables: {
                    file,
                    studyId,
                    description: JSON.stringify(description),
                    fileLength: file.size
                }
            }).then(result => {
                delete (window as any).onUploadProgressHackMap[uploadMapHackName];
                delete progressReports[uploadMapHackName];
                removeFile(file);
                notification.success({
                    message: 'Upload succeeded!',
                    description: `File ${result.data.uploadFile.fileName} was successfully uploaded!`,
                    placement: 'topRight'
                });
            }).catch(error => {
                delete (window as any).onUploadProgressHackMap[uploadMapHackName];
                delete progressReports[uploadMapHackName];
                notification.error({
                    message: 'Upload error!',
                    description: error?.message ?? error ?? 'Unknown Error Occurred!',
                    placement: 'topRight',
                    duration: 0
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
        fileList: fileList.map(file => ({
            ...file,
            originFileObj: file
        })),
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

    const fileDetailsColumns = [
        {
            title: 'File name',
            dataIndex: 'name',
            key: 'fileName',
            sorter: (a, b) => a.fileName.localeCompare(b.fileName),
            render: (value, record) => {
                const progress = progressReports[`UP_${record.participantId}_${record.deviceId}_${record.startDate?.valueOf()}_${record.endDate?.valueOf()}`];
                if (progress)
                    return <Fragment key={uploadMovement}>{Math.round(1000 * (progress.loaded - 1) / progress.total) / 10}%</Fragment>;
                return value;
            }
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
                })
            };
        });

    const fileNameColumns = [
        {
            title: 'File name',
            dataIndex: 'name',
            key: 'fileName',
            sorter: (a, b) => a.fileName.localeCompare(b.fileName),
            render: (value, record) => {
                const progress = progressReports[`UP_${record.participantId}_${record.deviceId}_${record.startDate?.valueOf()}_${record.endDate?.valueOf()}`];
                if (progress)
                    return <Fragment key={uploadMovement}>{Math.round(1000 * (progress.loaded - 1) / progress.total) / 10}%</Fragment>;
                return value;
            }
        },
        {
            key: 'delete',
            render: (__unused__value, record) => <Button disabled={isUploading} type='primary' danger icon={<DeleteOutlined />} onClick={() => {
                removeFile(record);
            }}></Button>
        }]
        .map(col => ({
            ...col,
            onCell: record => ({
                record: {
                    ...record,
                    period: [record.startDate, record.endDate]
                },
                editable: false,
                dataIndex: col.dataIndex,
                title: col.title,
                handleSave
            })
        }
        ));

    if (getOrgsLoading || getStudyLoading || getUsersLoading || whoAmILoading)
        return <LoadSpinner />;

    if (getOrgsError || getStudyError || getUsersError || whoAmIError)
        return <div className={`${css.tab_page_wrapper} ${css.both_panel} ${css.upload_overlay}`}>
            An error occured, please contact your administrator
        </div>;

    const userIdNameMapping = getUsersData.getUsers.reduce((a, b) => { a[b['id']] = b['firstname'].concat(' ').concat(b['lastname']); return a; }, {});

    const sites = getOrgsData.getOrganisations.filter(org => org.metadata?.siteIDMarker).reduce((prev, current) => ({
        ...prev,
        [current.metadata.siteIDMarker]: current.shortname ?? current.name
    }), {});

    function dataSourceFilter(files: IFile[]) {
        if (getStudyData.getStudy.type === studyType.SENSOR) {
            return files.filter(file =>
                file !== null && file !== undefined &&
                (!searchTerm
                    || (JSON.parse(file.description).participantId).toUpperCase().indexOf(searchTerm) > -1
                    || sites[JSON.parse(file.description).participantId[0]].toUpperCase().indexOf(searchTerm) > -1
                    || JSON.parse(file.description).deviceId.toUpperCase().indexOf(searchTerm) > -1
                    || deviceTypes[JSON.parse(file.description).deviceId.substr(0, 3)].toUpperCase().indexOf(searchTerm) > -1
                    || (!userIdNameMapping[file.uploadedBy] || userIdNameMapping[file.uploadedBy].toUpperCase().indexOf(searchTerm) > -1))
            ).sort((a, b) => parseInt(b.uploadTime) - parseInt(a.uploadTime));
        } else {
            return files.filter(file =>
                file !== null && file !== undefined &&
                (!searchTerm
                    || file.fileName.toUpperCase().indexOf(searchTerm) > -1));
        }
    }

    const sortedFiles = dataSourceFilter(getStudyData.getStudy.files).sort((a, b) => parseInt((b as any).uploadTime) - parseInt((a as any).uploadTime));
    const numberOfFiles = sortedFiles.length;
    const sizeOfFiles = sortedFiles.reduce((a, b) => a + (parseInt(b['fileSize'] as any) || 0), 0);
    const participantOfFiles = sortedFiles.reduce(function (values, v) {
        if (!values.set[JSON.parse(v['description'])['participantId']]) {
            (values as any).set[JSON.parse(v['description'])['participantId']] = 1;
            values.count++;
        }
        return values;
    }, { set: {}, count: 0 }).count;
    // format the file structure
    const fileSummary: any[] = [];
    const categoryColumns: any[] = [];
    if (getStudyData.getStudy.type === studyType.SENSOR) {
        const availableSites: string[] = Array.from(new Set(getStudyData.getStudy.files.map(el => JSON.parse(el.description).participantId[0]).sort()));
        const availableDeviceTypes: string[] = Array.from(new Set(getStudyData.getStudy.files.map(el => JSON.parse(el.description).deviceId.substr(0, 3)).sort()));
        categoryColumns.push([
            {
                title: 'Site',
                dataIndex: 'site',
                key: 'site',
                render: (__unused__value, record) => sites[record.site] ? sites[record.site].concat(' (').concat(record.site).concat(')') : record.site
            }
        ]);
        for (const deviceType of availableDeviceTypes) {
            categoryColumns.push({
                title: deviceType,
                dataIndex: deviceType,
                key: deviceType,
                render: (__unused__value, record) => record[deviceType] ? record[deviceType].toString() : deviceTypes[record[deviceType]]
            });
        }
        categoryColumns.push({
            title: 'Total',
            dataIndex: 'Total',
            key: 'total',
            render: (__unused__value, record) => record.total
        });
        for (const site of availableSites) {
            const tmpData: any = {
                site: site
            };
            for (const deviceType of availableDeviceTypes) {
                tmpData[deviceType] = getStudyData.getStudy.files.filter(el => (JSON.parse(el.description).participantId[0] === site
                    && JSON.parse(el.description).deviceId.substr(0, 3) === deviceType)).length;
            }
            tmpData.total = getStudyData.getStudy.files.filter(el => JSON.parse(el.description).participantId[0] === site).length;
            fileSummary.push(tmpData);
        }
        const tmpData: any = {
            site: 'Total',
            total: getStudyData.getStudy.files.length
        };
        for (const deviceType of availableDeviceTypes) {
            tmpData[deviceType] = getStudyData.getStudy.files.filter(el => JSON.parse(el.description).deviceId.substr(0, 3) === deviceType).length;
        }
        fileSummary.push(tmpData);
    }
    return <div {...getRootProps() as HTMLAttributes<HTMLDivElement>} className={`${css.scaffold_wrapper} ${isDropOverlayShowing ? css.drop_overlay : ''}`}>
        <input title='fileTabDropZone' {...getInputProps()} />
        {fileList.length > 0
            ?
            <div className={`${css.tab_page_wrapper} ${css.both_panel} ${css.upload_overlay}`}>
                <Subsection title='Upload files'>
                    <Upload {...uploaderProps} >
                        <Button>Select more files</Button>
                    </Upload>
                    <br />
                    <br />
                    <Table
                        rowKey={(rec) => rec.uuid}
                        rowClassName={() => css.editable_row}
                        pagination={false}
                        columns={(getStudyData.getStudy.type === studyType.ANY || getStudyData.getStudy.type === studyType.CLINICAL) ? fileNameColumns : fileDetailsColumns}
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
                <SubsectionWithComment title='Dataset Description' comment={
                    whoAmIData.whoAmI.type === userTypes.ADMIN ?
                        <>
                            {isEditingDescription ?
                                <>
                                    <Button
                                        type='primary'
                                        onClick={() => { editStudy({ variables: { studyId: getStudyData.getStudy.id, description: datasetDescription } }); }}
                                    >{'Submit'}
                                    </Button>
                                    <Button
                                        type='primary'
                                        onClick={() => { setIsEditingDescription(false); setDatasetDescription(''); }}
                                    >{'Cancel'}
                                    </Button>
                                </> :
                                <Button
                                    type='primary'
                                    onClick={() => { setIsEditingDescription(true); }}
                                >{'Edit Description'}
                                </Button>
                            }
                        </> : null
                }>
                    <>{
                        (isEditingDescription && whoAmIData.whoAmI.type === userTypes.ADMIN) ? <Input onChange={(e) => { setDatasetDescription(e.target.value); }}>
                        </Input> :
                            (getStudyData.getStudy.description === null || getStudyData.getStudy.description === '') ? 'No descriptions.' : getStudyData.getStudy.description
                    }</>
                    <br />
                    <br />
                </SubsectionWithComment>
                <Subsection title='Upload files'>
                    <Query<any, any> query={GET_STUDY} variables={{ studyId }}>
                        {({ loading, data, error }) => {
                            if (loading || error)
                                return <>To upload files you can click on the button below or drag and drop files directly from your hard drive.</>;
                            return <>To upload files to <i>{data.getStudy.name}</i> you can click on the button below or drag and drop files directly from your hard drive.</>;
                        }}
                    </Query>
                    <br />
                    If the file name is of the form <Tag style={{ fontFamily: 'monospace' }}>XAAAAAA-DDDBBBBBB-00000000-00000000.EXT</Tag>we will extract metadata automatically. If not, you will be prompted to enter the relevant information.<br /><br />
                    <Upload {...uploaderProps}>
                        <Button>Select files</Button>
                    </Upload>
                    <br />
                    <br />
                    <br />
                </Subsection>
                <SubsectionWithComment
                    title='Existing files'
                    comment={<Space size={'large'}>
                        <span>Total Files: {numberOfFiles}</span>
                        <span>Total Size: {formatBytes(sizeOfFiles)}</span>
                        <span>Total Participants: {participantOfFiles}</span>
                        {
                            (getStudyData.getStudy.type === studyType.ANY || getStudyData.getStudy.type === studyType.CLINICAL) ? null :
                                <Button onClick={() => setIsFileSummaryShown(true)}>File Details</Button>
                        }
                    </Space>}
                >
                    <Modal visible={isFileSummaryShown} onCancel={() => setIsFileSummaryShown(false)} onOk={() => setIsFileSummaryShown(false)} width={'100%'}>
                        <div>Number of files associated to sites and device types.</div><br />
                        <Table
                            pagination={false}
                            columns={categoryColumns}
                            dataSource={fileSummary}
                            size='small'
                        /><br />
                        <Space wrap={true}>
                            {Object.keys(deviceTypes).sort().map(el => <Tag>{`${el}: ${deviceTypes[el]}`}</Tag>)}
                        </Space>
                    </Modal>
                    <Input.Search allowClear placeholder='Search' onChange={({ target: { value } }) => setSearchTerm(value?.toUpperCase())} />
                    <FileList type={getStudyData.getStudy.type} files={sortedFiles} searchTerm={searchTerm}></FileList>
                    <br />
                    <br />
                </SubsectionWithComment>

            </div>
        }
    </div >;
};

const EditableContext = createContext<any>({});

type EditableRowProps = {
    index: number;
}

const EditableRow: FunctionComponent<EditableRowProps> = ({ index, ...props }) => {
    const [form] = Form.useForm();

    useEffect(() => {
        form.validateFields();
    });

    return (
        <Form form={form} component={false}>
            <EditableContext.Provider value={form}>
                <tr key={index} {...props} />
            </EditableContext.Provider>
        </Form>
    );
};

interface EditableCellProps {
    editable: boolean;
    children: ReactNode;
    dataIndex: string;
    record: StudyFile;
    handleSave: (__unused__record: StudyFile) => void;
}

const EditableCell: FunctionComponent<EditableCellProps> = ({
    editable,
    children,
    dataIndex,
    record,
    handleSave,
    ...restProps
}) => {
    const [editing, setEditing] = useState(false);
    const inputRef = useRef<InputRef>(null);
    const rangeRef = useRef<any>(null);
    const form = useContext(EditableContext);
    const { loading: getOrgsLoading, error: getOrgsError, data: getOrgsData } = useQuery(GET_ORGANISATIONS);

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

    if (getOrgsLoading)
        return <LoadSpinner />;

    if (getOrgsError)
        return <div className={`${css.tab_page_wrapper} ${css.both_panel} ${css.upload_overlay}`}>
            An error occured, please contact your administrator: {getOrgsError.message}
        </div>;

    const sites = getOrgsData.getOrganisations.filter(org => org.metadata?.siteIDMarker).reduce((prev, current) => ({
        ...prev,
        [current.metadata.siteIDMarker]: current.name
    }), {});

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
                            }
                        })
                    ]}
                >
                    <RangePicker id={`period_${record.uuid}`} allowClear={false} ref={rangeRef} defaultValue={[record.startDate ?? null, record.endDate ?? null]} disabledDate={(currentDate) => {
                        return dayjs().isBefore(currentDate);
                    }} onCalendarChange={(dates) => {
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
                        return Promise.resolve();
                    }
                }]}
            >
                <Input id={`${dataIndex}_${record.uuid}`} ref={inputRef} allowClear={false} onPressEnter={save} onBlur={save} style={{ width: '100%' }} />
            </Form.Item>;
        }
    }

    return <td {...restProps}>{childNode}</td>;
};
