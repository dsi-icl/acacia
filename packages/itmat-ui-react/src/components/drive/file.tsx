import React, { FunctionComponent, useEffect } from 'react';
import css from './drive.module.css';
import { Input, Button, Row, Col, Table, Menu, notification, Modal, Tag, Upload, Tooltip, Form, Checkbox, List, Dropdown, Spin, Select, UploadFile } from 'antd';
import { IDrive, IDrivePermission, IUserWithoutToken, enumDriveNodeTypes } from '@itmat-broker/itmat-types';
import { FileTwoTone, FolderTwoTone, MailOutlined, MinusOutlined, MoreOutlined, PlusOutlined, ShareAltOutlined, UploadOutlined, UsergroupAddOutlined } from '@ant-design/icons';
import { trpc } from '../../utils/trpc';
import { useQueryClient } from '@tanstack/react-query';
import { convertFileListToApiFormat, formatBytes } from '../../utils/tools';
import axios, { AxiosError } from 'axios';
import { RcFile } from 'antd/es/upload';
import ClipLoader from 'react-spinners/ClipLoader';

const { Column } = Table;
const { Option } = Select;

export const MyFile: FunctionComponent = () => {
    const whoAmI = trpc.user.whoAmI.useQuery();
    const getUsers = trpc.user.getUsers.useQuery({});
    const getDrives = trpc.drive.getDrives.useQuery({});

    const [isInitialize, setIsInitialize] = React.useState(true);
    const queryClient = useQueryClient();
    const [currentLocationPath, setCurrentLocationPath] = React.useState<string[]>([]);
    const [isCreatingFolder, setIsCreatingFolder] = React.useState(false);
    const [isSharingDrive, setIsSharingDrive] = React.useState(false);
    const [currentNodeId, setCurrentNodeId] = React.useState<string | null>(null);
    const [isRecursiveUploading, setIsRecursiveUploading] = React.useState(false);
    const [uploadingFolderFileList, setUploadingFolderFileList] = React.useState<RcFile[]>([]);
    const [isUploading, setIsUploading] = React.useState(false);

    useEffect(() => {
        if (isInitialize && getDrives?.data) {
            setCurrentLocationPath([getDrives.data?.[whoAmI.data.id].filter(el => el.parent === null)[0].id]);
            setIsInitialize(false);
        }
    }, [getDrives.data, isInitialize, whoAmI.data.id]);

    useEffect(() => {
        if (isRecursiveUploading && uploadingFolderFileList.length > 0) {
            const uploadAllFiles = async () => {
                const tPaths: string[][] = [];
                const files = await convertFileListToApiFormat(uploadingFolderFileList, 'files');
                const formData = new FormData();
                if (files.length > 0) {
                    for (let i = 0; i < files.length; i++) {
                        const pathFromCurrent: string[] = uploadingFolderFileList[i].webkitRelativePath.split('/');
                        if (pathFromCurrent[pathFromCurrent.length - 1].startsWith('.')) {
                            continue;
                        }
                        formData.append('files', files[i].stream, files[i].originalname);
                        tPaths.push(pathFromCurrent);
                    }
                }

                formData.append('parentId', currentLocationPath[currentLocationPath.length - 1]);
                formData.append('paths', JSON.stringify(tPaths));
                setIsUploading(true);
                const response = await axios.post('/trpc/drive.createRecursiveDrives', formData, {
                    headers: {
                        'Content-Type': 'multipart/form-data'
                    }
                });
                if (response?.data?.result?.data?.length) {
                    const queryKey = [['drive', 'getDrives'], { input: {}, type: 'query' }];
                    // log each query's key and data
                    const cache = queryClient.getQueryData(queryKey) ?? [];
                    const newCache = Array.from(new Map([...cache[whoAmI.data.id], ...response.data.result.data].map(item => [item.id, item])).values());
                    const newQueryCache = {
                        ...cache,
                        [whoAmI.data.id]: newCache
                    };
                    queryClient.setQueryData(queryKey, newQueryCache);
                    void queryClient.invalidateQueries(['drive', 'getDrives', { input: {} }]);
                    notification.success({
                        message: 'Directory has been uploaded.',
                        description: '',
                        placement: 'topRight',
                        duration: 0
                    });
                    setIsCreatingFolder(false);
                } else {
                    notification.error({
                        message: 'Direcroty upload error!',
                        description: 'Unknown Error Occurred!',
                        placement: 'topRight',
                        duration: 0
                    });
                }
                setIsUploading(false);
                setIsRecursiveUploading(false);
            };
            try {
                void uploadAllFiles();
            } catch (error) {
                if (error instanceof AxiosError) {
                    notification.error({
                        message: 'Upload error!',
                        description: `${error.response?.data?.error?.message ?? 'An unknown error occurred.'}`,
                        placement: 'topRight',
                        duration: 0
                    });
                } else {
                    notification.error({
                        message: 'Upload error!',
                        description: 'An unknown error occurred.',
                        placement: 'topRight',
                        duration: 0
                    });
                }
            }
        }
    }, [currentLocationPath, isRecursiveUploading, queryClient, setUploadingFolderFileList, uploadingFolderFileList, whoAmI.data.id]);

    const createDriveFolder = trpc.drive.createDriveFolder.useMutation({
        onSuccess: (data) => {
            const queryKey = [['drive', 'getDrives'], { input: {}, type: 'query' }];
            // log each query's key and data
            const cache = queryClient.getQueryData(queryKey) ?? [];
            const newCache = [...cache[whoAmI.data.id], data];
            const newQueryCache = {
                ...cache,
                [whoAmI.data.id]: newCache
            };
            queryClient.setQueryData(queryKey, newQueryCache);
            void queryClient.invalidateQueries(['drive', 'getDrives', { input: {} }]);

            notification.success({
                message: `Folder ${data.name} has been created.`,
                description: '',
                placement: 'topRight',
                duration: 0
            });
            setIsCreatingFolder(false);
        },
        onError(error) {
            if (error instanceof AxiosError) {
                notification.error({
                    message: 'Upload error!',
                    description: `${error.response?.data?.error?.message ?? 'An unknown error occurred.'}`,
                    placement: 'topRight',
                    duration: 0
                });
            } else {
                notification.error({
                    message: 'Upload error!',
                    description: 'An unknown error occurred.',
                    placement: 'topRight',
                    duration: 0
                });
            }
        }
    });

    const deleteDrive = trpc.drive.deleteDrive.useMutation({
        onSuccess: (data) => {
            const queryKey = [['drive', 'getDrives'], { input: {}, type: 'query' }];
            // log each query's key and data
            const cache = queryClient.getQueryData(queryKey) ?? [];
            const newCache = cache[whoAmI.data.id].filter(el => el.id !== data.id);
            const newQueryCache = {
                ...cache,
                [whoAmI.data.id]: newCache
            };
            queryClient.setQueryData(queryKey, newQueryCache);
        },
        onError(error) {
            notification.error({
                message: 'Delete error!',
                description: error.message || 'Unknown Error Occurred!',
                placement: 'topRight',
                duration: 0
            });
        }
    });

    const shareDriveViaEmail = trpc.drive.shareDriveToUserViaEmail.useMutation({
        onSuccess: () => {
            setIsSharingDrive(false);
            notification.success({
                message: 'Drive shared successfully!',
                description: '',
                placement: 'topRight',
                duration: 0
            });
        },
        onError(error) {
            setIsSharingDrive(false);
            notification.error({
                message: 'Upload error!',
                description: error.message || 'Unknown Error Occurred!',
                placement: 'topRight',
                duration: 0
            });
        }
    });
    const fileTableColumns = [
        {
            title: 'Name',
            dataIndex: 'value',
            key: 'value',
            width: '40%',
            render: (value, record) => {
                const icon = record.type === enumDriveNodeTypes.FILE ? <FileTwoTone /> : <FolderTwoTone />;
                const content = (
                    <span className={css.customTextHover} onClick={() => {
                        if (record.type === enumDriveNodeTypes.FOLDER) {
                            setCurrentLocationPath([...currentLocationPath, record.id]);
                        }
                    }}>
                        {icon}
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            &nbsp;{record.name}
                        </span>
                    </span>
                );

                return (
                    <div className={css.ellipsisStyle}>
                        <div className={css.textAndIcon}>
                            {content}
                        </div>
                        <div className={css.cellIcons}>
                            {/* Share Icon with Tooltip */}
                            <Tooltip title="Share this item">
                                <ShareAltOutlined
                                    className={css.cellIcon}
                                    onClick={(e) => {
                                        setIsSharingDrive(true);
                                        setCurrentNodeId(record.id);
                                        e.stopPropagation(); // Prevent triggering Dropdown
                                    }}
                                />
                            </Tooltip>

                            {/* More Icon (Ellipsis) with Dropdown and Tooltip */}
                            <Dropdown overlay={
                                <Menu onClick={(e) => {
                                    if (e.key === 'download') {
                                        const a = document.createElement('a');
                                        a.href = `/file/${record.fileId}`;
                                        a.setAttribute('download', record.name || 'download'); // Optional: provide a default file name
                                        document.body.appendChild(a);
                                        a.click();
                                        document.body.removeChild(a);
                                    } else if (e.key === 'delete') {
                                        // Handle delete logic here
                                    }
                                }}>
                                    {
                                        record.type === enumDriveNodeTypes.FILE &&
                                        <Menu.Item key="download" title="Download the file">
                                            Download
                                        </Menu.Item>
                                    }
                                    <Menu.Item key="delete" title="Delete the file from the system" onClick={() => {
                                        deleteDrive.mutate({ driveId: record.id });
                                    }}>
                                        Delete
                                    </Menu.Item>
                                    {/* Add more Menu.Item components as needed */}
                                </Menu>
                            } trigger={['click']}>
                                <Tooltip title="More actions">
                                    <a onClick={(e) => e.stopPropagation()}>
                                        <MoreOutlined className={css.cellIcon} />
                                    </a>
                                </Tooltip>
                            </Dropdown>
                        </div>
                    </div>
                );
            }
        }
        ,
        {
            title: 'Modified',
            dataIndex: 'modified',
            key: 'modified',
            width: '10%',
            sorter: (a, b) => a.life.createdTime - b.life.createdTime,
            render: (__unused__value, record) => <span>{new Date(record.life.createdTime).toLocaleDateString()}</span>
        },
        {
            title: 'File Size',
            dataIndex: 'fileSize',
            key: 'fileSize',
            width: '10%',
            render: (__unused__value, record) => <span>{formatBytes(record.metadata.fileSize)}</span>
        },
        {
            title: 'Sharing',
            dataIndex: 'sharedUsers',
            key: 'sharedUsers',
            width: '10%',
            render: (__unused__value, record) => {
                if (record.sharedUsers.length >= 1) {
                    return (
                        <div
                            className={css.customTextHover} // Reuse the hover effect
                            onClick={() => {
                                setIsSharingDrive(true);
                                setCurrentNodeId(record.id);
                            }} // Attach the click event handler
                        >
                            <UsergroupAddOutlined /> Shared
                        </div>
                    );
                } else {
                    return (
                        <div
                            className={css.customTextHover} // Reuse the hover effect for consistency
                            onClick={() => {
                                setIsSharingDrive(true);
                                setCurrentNodeId(record.id);
                            }} // Attach the click event handler even if it's private
                        >
                            Private
                        </div>
                    );
                }
            }
        }
    ];

    const handleUploadFile = async (fileList: UploadFile[], variables: Record<string, string>) => {
        try {
            const files = await convertFileListToApiFormat(fileList, 'file');
            setIsUploading(true);
            const formData = new FormData();

            if (files.length > 0) {
                files.forEach(file => {
                    formData.append('file', file.stream, file.originalname);
                });
            }

            // Append other variables to formData
            Object.entries(variables).forEach(([key, value]) => {
                variables[key] && formData.append(key, String(value));
            });

            // Perform the request via axios
            const response = await axios.post('/trpc/drive.createDriveFile', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });

            if (response?.data?.result?.data?.id) {
                const queryKey = [['drive', 'getDrives'], { input: { userId: whoAmI?.data?.id }, type: 'query' }];
                // log each query's key and data
                const cache = queryClient.getQueryData(queryKey) ?? [];
                const newCache = [...cache[whoAmI.data.id], response.data.result.data];
                const newQueryCache = {
                    ...cache,
                    [whoAmI.data.id]: newCache
                };
                queryClient.setQueryData(queryKey, newQueryCache);
                notification.success({
                    message: `File ${response.data.result.data.name} has been uploaded.`,
                    description: '',
                    placement: 'topRight',
                    duration: 0
                });
                setIsUploading(false);
            }
        } catch (error) {
            if (error instanceof AxiosError) {
                notification.error({
                    message: 'Upload error!',
                    description: `${error.response?.data?.error?.message ?? 'An unknown error occurred.'}`,
                    placement: 'topRight',
                    duration: 0
                });
            } else {
                notification.error({
                    message: 'Upload error!',
                    description: 'An unknown error occurred.',
                    placement: 'topRight',
                    duration: 0
                });
            }
            setIsUploading(false);
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <>
            <div className={css.file_wrapper}>
                {
                    isUploading && <LoadingIcon />
                }
                <List
                    header={
                        <div className={css['overview-header']}>
                            <div className={css['overview-icon']}></div>
                            <div>My files</div>
                        </div>
                    }
                >
                    <List.Item>
                        <Row justify="space-between" gutter={1} style={{ width: '100%' }}>
                            <Col>
                                <Row gutter={1}>
                                    <Col span={1.5}>
                                        <Dropdown overlay={<Menu onClick={(e) => {
                                            if (e.key === 'newFolder') {
                                                setIsCreatingFolder(true);
                                            }
                                            // Add more conditions for other menu items here
                                        }}>
                                            <Menu.Item key="newFolder">New Folder</Menu.Item>
                                        </Menu>} trigger={['click']}>
                                            <Button icon={<PlusOutlined />}>New</Button>
                                        </Dropdown>
                                    </Col>
                                    <Col span={1.5}>
                                        <Dropdown overlay={<Menu onClick={() => {
                                            // if (e.key === 'files') {
                                            //     setIsUploadingFile(true);
                                            // }
                                        }}>
                                            <Menu.Item key="files">
                                                <Upload
                                                    showUploadList={false}
                                                    multiple={true}
                                                    beforeUpload={(file) => {
                                                        return void handleUploadFile([file], {
                                                            parentId: currentLocationPath[currentLocationPath.length - 1]

                                                        });
                                                    }}
                                                >
                                                    {'Files'}
                                                </Upload>
                                            </Menu.Item>
                                            <Menu.Item key="otherOption1">
                                                <Upload
                                                    showUploadList={false}
                                                    multiple={true}
                                                    directory={true}
                                                    beforeUpload={(_, fileList) => {
                                                        setUploadingFolderFileList(fileList);
                                                        setIsRecursiveUploading(true);
                                                    }}
                                                >
                                                    {'  Directory'}
                                                </Upload>
                                            </Menu.Item>
                                            {/* <Menu.Item key="otherOption2">Other Option 2</Menu.Item> */}
                                            {/* Add more Menu.Item components as needed */}
                                        </Menu>} trigger={['click']}>
                                            <Button icon={<UploadOutlined />}>Upload</Button>
                                        </Dropdown>
                                    </Col>
                                    <Col span={1}>
                                        <Button>...</Button>
                                    </Col>
                                </Row>
                            </Col>
                            <Col
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    position: 'relative' // Ensure relative positioning if necessary
                                }}
                            >
                                {
                                    isUploading ? (
                                        <div
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                marginRight: '16px' // Adjust the space as needed
                                            }}
                                        >
                                            <ClipLoader />
                                            <span style={{ marginLeft: '8px' }}>Uploading...Please wait</span>
                                        </div>
                                    ) : null
                                }
                                <Button
                                    onClick={() => {
                                        const t = [...currentLocationPath];
                                        setCurrentLocationPath(t.length > 1 ? t.slice(0, -1) : t);
                                    }}
                                >
                                    Back
                                </Button>
                            </Col>
                        </Row>
                    </List.Item>
                    <List.Item>
                        <CreateFolder
                            isModalShown={isCreatingFolder}
                            setIsModalShown={setIsCreatingFolder}
                            uploadFunc={createDriveFolder}
                            uploadVariables={{ userId: whoAmI.data.id, parentNodeId: currentLocationPath[currentLocationPath.length - 1] }}
                        />
                        <div className={css.breadcrumbContainer}>
                            {

                                currentLocationPath.map((el, index) => {
                                    const isLast = index === currentLocationPath.length - 1;
                                    const folderName = getDrives?.data?.[whoAmI.data.id]?.find(es => es.id === el)?.name || 'Unknown';
                                    return (
                                        <React.Fragment key={el}>
                                            <Tag
                                                className={css.customTextHover}
                                                color="cyan"
                                                style={{ marginRight: '5px' }}
                                                onClick={() => setCurrentLocationPath(currentLocationPath.slice(0, index + 1))}
                                            >
                                                {folderName}
                                            </Tag>
                                            {!isLast && <span style={{ marginRight: '5px' }}>/</span>}
                                        </React.Fragment>
                                    );
                                })

                            }
                        </div>
                    </List.Item>
                    <List.Item>
                        <Table
                            style={{ width: '100%', fontSize: '20px' }}
                            scroll={{ y: '400px' }}
                            columns={fileTableColumns}
                            expandable={{ showExpandColumn: false }}
                            dataSource={getDrives.data?.[whoAmI.data.id]?.filter(el => el.parent === currentLocationPath[currentLocationPath.length - 1])}
                        />
                        <ShareFileModal isModalShown={isSharingDrive} setIsModalShown={setIsSharingDrive} shareFunc={shareDriveViaEmail} shareVariables={{ userId: whoAmI.data.id, nodeId: currentNodeId }} currentDrive={getDrives.data?.[whoAmI.data.id].filter(el => el.id === currentNodeId)[0]} users={getUsers.data ?? []} />
                    </List.Item>
                </List >
            </div >
            <div className={css.shared_container}>
                <SharedFiles users={getUsers.data ?? []} sharedUserFiles={getDrives.data ?? {}} self={whoAmI.data} deleteDriveFunc={deleteDrive} />
            </div>
        </>
    );
};

export const CreateFolder: FunctionComponent<{ isModalShown, setIsModalShown, uploadFunc, uploadVariables }> = ({ isModalShown, setIsModalShown, uploadFunc, uploadVariables }) => {
    const [folderName, setFolderName] = React.useState<string | null>(null);
    const [description, setDescription] = React.useState<string | undefined>(undefined);
    return (
        <Modal
            title='Create a folder'
            open={isModalShown}
            onOk={() => {
                uploadFunc.mutate({
                    folderName: folderName,
                    parentId: uploadVariables.parentNodeId,
                    description: description ?? undefined
                });
            }}
            onCancel={() => setIsModalShown(false)}
        >
            <Input onChange={(event) => setFolderName(event.target.value)} placeholder='Folder Name' required={true}></Input>
            <br /><br />
            <Input onChange={(event) => setDescription(event.target.value)} placeholder='Description'></Input>
        </Modal>
    );
};

export const ShareFileModal: FunctionComponent<{ isModalShown: boolean, setIsModalShown, shareFunc, shareVariables: Record<string, unknown>, currentDrive?: IDrive, users: IUserWithoutToken[] }> = ({ isModalShown, setIsModalShown, shareFunc, currentDrive, users }) => {
    const [form] = Form.useForm();
    if (!currentDrive) {
        return null;
    }
    const tmp = currentDrive.sharedUsers.map(el => {
        const user = users.filter(ek => ek.id === el.iid)[0];
        const tmp: Partial<IDrivePermission> & { user?: string, email?: string } = { ...el };
        if (!user) {
            tmp.user = 'NA';
            tmp.email = 'NA';
        } else {
            tmp.user = `${user.firstname} ${user.lastname}`;
            tmp.email = user.email;
        }
        return tmp;
    });
    const reformattedSharedUsers = {
        ...currentDrive,
        sharedUsers: tmp
    };
    return (
        <Modal
            width={'80%'}
            title='Share to a user'
            open={isModalShown}
            onCancel={() => setIsModalShown(false)}
            footer={null}
        >
            <Form name="dynamic_form_item" initialValues={reformattedSharedUsers} form={form}>
                <Form.List name="sharedUsers">
                    {(sharedUsers, { add, remove }) => {
                        return <EditPermissionTable sharedUsers={sharedUsers} add={add} remove={remove} users={users} />;
                    }}
                </Form.List>
                <Form.Item>
                    <Button type="primary" htmlType="submit" onClick={() => {
                        for (const user of form.getFieldValue('sharedUsers')) {
                            shareFunc.mutate({
                                userEmails: [user.email],
                                driveId: currentDrive.id,
                                permissions: {
                                    read: user.read,
                                    write: user.write,
                                    delete: user.delete
                                }
                            });
                        }
                    }}>
                        Submit
                    </Button>
                </Form.Item>
            </Form>
        </Modal>
    );
};

export const EditPermissionTable: FunctionComponent<{ sharedUsers, add, remove, users: IUserWithoutToken[] }> = ({ sharedUsers, add, remove }) => {
    const columns = [{
        title: 'User',
        dataIndex: 'user',
        key: 'user',
        minWidth: 100 // Example minimum width
        // ... other properties
    }, {
        title: 'Email',
        dataIndex: 'email',
        key: 'email',
        minWidth: 200 // Example minimum width
        // ... other properties
        // ... other columns remain unchanged
    }, {
        title: 'Read',
        dataIndex: 'read',
        key: 'read',
        render: (__unused__value, record) => {
            return <Checkbox checked={record.read}></Checkbox>;
        }
    }, {
        title: 'Write',
        dataIndex: 'write',
        key: 'write',
        render: (__unused__value, record) => {
            return <Checkbox checked={record.write}></Checkbox>;
        }
    }, {
        title: 'Delete',
        dataIndex: 'delete',
        key: 'delete',
        render: (__unused__value, record) => {
            return <Checkbox checked={record.delete}></Checkbox>;
        }
    }];
    return (
        <Table
            dataSource={sharedUsers}
            pagination={false}
            tableLayout='fixed'
            footer={() => {
                return (
                    <Form.Item>
                        <Button onClick={() => add({ user: undefined, email: undefined, read: false, write: false, delete: false })}>
                            <PlusOutlined /> Add subjects
                        </Button>
                    </Form.Item>
                );
            }}
        >
            {
                columns.slice(0, 2).map(el =>
                    <Column
                        dataIndex={el.dataIndex}
                        title={el.title}
                        render={(value, row, index) => {
                            return (
                                <Form.Item name={[index, el.dataIndex]}>
                                    <Input
                                        disabled={el.dataIndex === 'email' ? false : true}
                                        placeholder={el.dataIndex}
                                        style={{ width: '100%', marginRight: 8 }}
                                    />
                                </Form.Item>
                            );
                        }}
                    />
                )
            }
            {
                columns.slice(2, 5).map(el =>
                    <Column
                        dataIndex={el.dataIndex}
                        title={el.title}
                        render={(value, row, index) => {
                            return (
                                <Form.Item name={[index, el.dataIndex]} valuePropName='checked'>
                                    <Checkbox
                                        style={{ width: '30%', marginRight: 8 }}
                                    />
                                </Form.Item>
                            );
                        }}
                    />
                )
            }
            <Column
                title={'Action'}
                render={(value, row) => {
                    return (
                        <Button
                            icon={<MinusOutlined />}
                            shape={'circle'}
                            onClick={() => remove((row as { name: string }).name)}
                        />
                    );
                }}
            />
        </Table>
    );
};

export const SharedFiles: FunctionComponent<{ users: IUserWithoutToken[], sharedUserFiles: Record<string, IDrive[]>, self: IUserWithoutToken, deleteDriveFunc }> = ({ users, sharedUserFiles, self, deleteDriveFunc }) => {
    const [currentSharedUser, setCurrentSharedUser] = React.useState<string | null>(null);
    const [currentLocationPath, setCurrentLocationPath] = React.useState<string[]>(['shared']);
    const sharedUsers: string[] = Object.keys(sharedUserFiles).filter(el => el !== self.id);
    const rootDrive: IDrive = {
        id: 'shared',
        managerId: self.id,
        path: ['shared'],
        restricted: true,
        name: 'Shared',
        fileId: null,
        type: enumDriveNodeTypes.FOLDER,
        parent: null,
        children: [],
        sharedUsers: [], // ids of shared users
        life: {
            createdTime: Date.now(),
            createdUser: self.id,
            deletedTime: null,
            deletedUser: null
        },
        metadata: {}
    };

    const reformattedFiles: IDrive[] = [];
    for (const key of Object.keys(sharedUserFiles)) {
        if (key === self.id) {
            continue;
        }
        const files = sharedUserFiles[key];
        const root = sharedUserFiles[key].filter(el => el.parent === null)[0];
        // if (root) {
        //     root.parent = rootDrive.id;
        //     rootDrive.children.push(root.id);
        // }
        for (const file of files) {
            const newFile = {
                ...file,
                path: [rootDrive.id].concat(file.path)
            };
            if (newFile.parent === root?.id) {
                newFile.parent = rootDrive.id;
                rootDrive.children.push(newFile.id);
            }
            reformattedFiles.push(newFile);
        }
    }
    reformattedFiles.push(rootDrive);

    const fileTableColumns = [
        {
            title: 'Name',
            dataIndex: 'value',
            key: 'value',
            render: (__unused__value, record) => {
                const icon = record.type === enumDriveNodeTypes.FILE ? <FileTwoTone /> : <FolderTwoTone />;
                const content = (
                    <span className={css.customTextHover} onClick={() => {
                        if (record.type === enumDriveNodeTypes.FOLDER) {
                            setCurrentLocationPath([...currentLocationPath, record.id]);
                        }
                    }}>
                        {icon}
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            &nbsp;{record.name}
                        </span>
                    </span>
                );

                return (
                    <div className={css.ellipsisStyle}>
                        <div className={css.textAndIcon}>
                            {content}
                        </div>
                        <div className={css.cellIcons}>
                            {/* Share Icon with Tooltip */}
                            <Dropdown overlay={
                                <Menu onClick={(e) => {
                                    if (e.key === 'download') {
                                        const a = document.createElement('a');
                                        a.href = `/file/${record.fileId}`;
                                        a.setAttribute('download', record.name || 'download'); // Optional: provide a default file name
                                        document.body.appendChild(a);
                                        a.click();
                                        document.body.removeChild(a);
                                    } else if (e.key === 'delete') {
                                        // Handle delete logic here
                                    }
                                }}>
                                    {
                                        record.type === enumDriveNodeTypes.FILE &&
                                        <Menu.Item key="download" title="Download the file">
                                            Download
                                        </Menu.Item>
                                    }
                                    {
                                        record.sharedUsers.some(el => el.delete) ?
                                            <Menu.Item key="delete" title="Delete the file from the system" onClick={() => {
                                                deleteDriveFunc.mutate({ driveId: record.id });
                                            }}>
                                                Delete
                                            </Menu.Item>
                                            : null
                                    }
                                </Menu>
                            } trigger={['click']}>
                                <Tooltip title="More actions">
                                    <a onClick={(e) => e.stopPropagation()}>
                                        <MoreOutlined className={css.cellIcon} />
                                    </a>
                                </Tooltip>
                            </Dropdown>
                        </div>
                    </div>
                );
            }
        },
        {
            title: 'Modified',
            dataIndex: 'modified',
            key: 'modified',
            render: (__unused__value, record) => <span>{new Date(record.life.createdTime).toUTCString()}</span>
        },
        {
            title: 'File Size',
            dataIndex: 'fileSize',
            key: 'fileSize',
            render: (__unused__value, record) => <span>{formatBytes(record.metadata.fileSize)}</span>
        },
        {
            title: 'Sharing',
            dataIndex: 'sharedBy',
            key: 'sharedBy',
            render: (__unused__value, record) => {
                const user = users.filter(el => el.id === record.managerId)[0];

                // Define styles
                const sharedByStyle = {
                    fontWeight: 'bold',
                    color: '#555' // Example: dark gray color
                };

                const userNameStyle = {
                    color: '#007bff', // Example: blue color
                    fontWeight: 'normal'
                };

                return (
                    <span>
                        <span style={sharedByStyle}>Shared By</span>
                        {' '}
                        <span style={userNameStyle}>{user ? `${user.firstname} ${user.lastname}` : 'NA'}</span>
                    </span>
                );
            }
        }
    ];
    const items = sharedUsers.map((el, index) => {
        const user = users.filter(es => es.id === el)[0];
        return {
            id: el,
            key: el,
            icon: <MailOutlined />,
            // children: [],
            label: user ? `${user.firstname} ${user.lastname}` : `Firstname_${index} Lastname_${index}`
        };
    });
    return (
        <List
            header={
                <div className={css['overview-header']} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div className={css['overview-header']} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                            <div className={css['overview-icon']}></div>
                            <div>Shared Files</div>
                        </div>
                    </div>
                    <div>
                        <Select
                            placeholder='Select a user'
                            onChange={(e) => {
                                setCurrentSharedUser(e);
                                const rootNode = sharedUserFiles[e].filter(el => el.managerId === e).filter(el => el.parent === null)[0];
                                setCurrentLocationPath([rootNode.id]);
                            }}
                        >
                            {
                                items.map(el => <Option value={el.id}>{el.label}</Option>)
                            }
                        </Select>
                    </div>
                </div>
            }
        >
            <List.Item>
                <div className={css.shared_container} style={{ width: '100%' }}>
                    <div>
                        {
                            currentLocationPath.map((el, index) => {
                                const tag = <Tag className={css.customTextHover} color='cyan' style={{ marginRight: '5px' }} onClick={() => {
                                    setCurrentLocationPath(currentLocationPath.slice(0, index + 1));
                                }}>{reformattedFiles.filter(es => es.id === el)[0].name}</Tag>;
                                if (index < currentLocationPath.length - 1) {
                                    return [tag, <span style={{ marginRight: '5px' }} key={`${el}-slash`}>/</span>];
                                } else {
                                    return tag;
                                }
                            })
                        }
                        <Table
                            style={{ width: '100%' }}
                            columns={fileTableColumns}
                            expandable={{ showExpandColumn: false }}
                            dataSource={currentSharedUser ? sharedUserFiles[currentSharedUser].filter(el => {
                                return el.managerId === currentSharedUser;
                            }).filter(el => el.parent === currentLocationPath[currentLocationPath.length - 1]) : []}
                        // dataSource={reformattedFiles.filter(el => el.parent === currentLocationPath[currentLocationPath.length - 1])}
                        />
                    </div >
                </div>
            </List.Item>
        </List>
    );
};

const LoadingIcon = () => {
    return (
        <div style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            zIndex: 1000
        }}>
            <Spin />
        </div>
    );
};
