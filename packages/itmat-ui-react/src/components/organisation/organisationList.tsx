import { FunctionComponent, useState } from 'react';
import { notification, Image, List, Table, Form, message, Button, Modal, Input } from 'antd';
import 'react-quill/dist/quill.snow.css';
import { trpc } from '../../utils/trpc';
import LoadSpinner from '../reusable/loadSpinner';
import dayjs from 'dayjs';
import weekday from 'dayjs/plugin/weekday';
import { DeleteOutlined, PlusOutlined, SmileOutlined } from '@ant-design/icons';
import css from './organisations.module.css';
import Upload, { RcFile, UploadFile } from 'antd/es/upload';
import { convertFileListToApiFormat, getBase64 } from '../../utils/tools';
import axios from 'axios';
import ImgCrop from 'antd-img-crop';

dayjs.extend(weekday);

export const OrganisationListSection: FunctionComponent = () => {
    const getOrganisations = trpc.organisation.getOrganisations.useQuery({});
    const [api, contextHolder] = notification.useNotification();
    const deleteOrganisation = trpc.organisation.deleteOrganisation.useMutation({
        onSuccess: (() => {
            api.open({
                message: 'Organisation has been deleted',
                description: '',
                duration: 10,
                icon: <SmileOutlined style={{ color: '#108ee9' }} />
            });
        }),
        onError: ((error) => {
            api.open({
                message: 'Error deleting organisation',
                description: error.message,
                duration: 10,
                icon: <SmileOutlined style={{ color: '#108ee9' }} />
            });
        })
    });

    if (getOrganisations.isLoading) {
        return <LoadSpinner />;
    }

    if (getOrganisations.isError) {
        return <p>
            An error occured, please contact your administrator
        </p>;
    }

    const columns = [{
        title: 'Name',
        dataIndex: 'name',
        key: 'name',
        ellipsis: true,
        render: (__unused__value, record) => {
            return <div>{record.name}</div>;
        }
    }, {
        title: 'Shortname',
        dataIndex: 'shortname',
        key: 'shortname',
        ellipsis: true,
        render: (__unused__value, record) => {
            return <div>{record.shortname}</div>;
        }
    }, {
        title: 'Logo',
        dataIndex: 'logo',
        key: 'logo',
        render: (__unused__value, record) => {
            return <div><Image
                width={200}
                src={record.profile ? `${window.location.origin}/file/${record.profile}` : undefined}
            /></div>;
        }
    }, {
        render: (__unused__value, record) => {
            return <DeleteOutlined onClick={() => deleteOrganisation.mutate({ organisationId: record.id })} />;
        }
    }];

    return (<div className={css.page_container}>
        {contextHolder}
        <List
            header={
                <div className={css['overview-header']} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div className={css['overview-header']} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                            <div className={css['overview-icon']}></div>
                            <div>List of Organisations</div>
                        </div>
                    </div>
                    <div>
                        <OrganisationCreation />
                    </div>
                </div>
            }
        >
            <Table
                dataSource={getOrganisations.data}
                columns={columns}
            >

            </Table>
        </List>
    </div>);
};

export const OrganisationCreation: FunctionComponent = () => {
    const [isModalOn, setIsModalOn] = useState<boolean>(false);
    const [form] = Form.useForm();
    const [fileList, setFileList] = useState<RcFile[]>([]);

    const handleCreateDomain = async (variables: Record<string, string>) => {
        try {
            const files = await convertFileListToApiFormat(fileList, 'profile');
            const formData = new FormData();
            if (files.length > 0) {
                files.forEach(file => {
                    formData.append('profile', file.stream, file.originalname);
                });
            }

            Object.entries(variables).forEach(([key, value]) => {
                variables[key] && formData.append(key, String(value));
            });

            const response = await axios.post('/trpc/organisation.createOrganisation', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });

            if (response?.data?.result?.data?.id) {
                void message.success('Domain created successfully');
            }

        } catch {
            void message.error('Error creating domain');
        }
    };

    const beforeUpload = (file: RcFile): boolean => {
        const isJpgOrPng = file.type === 'image/jpeg' || file.type === 'image/png';
        if (!isJpgOrPng) {
            void message.error('You can only upload JPG/PNG file!');
        }
        setFileList([file]);
        return isJpgOrPng;
    };

    const handlePreview = async (file: UploadFile) => {
        if (!file.url && !file.preview) {
            file.preview = await getBase64(file.originFileObj as RcFile);
        }
    };

    return (<div>
        <Button onClick={() => setIsModalOn(true)}>Create</Button>
        <Modal
            open={isModalOn}
            onOk={() => void handleCreateDomain(form.getFieldsValue())}
            onCancel={() => setIsModalOn(false)}
        >
            <Form
                form={form}
                layout='vertical'
            >
                <Form.Item
                    name="name"
                    label="Organisation Name"
                    rules={[{ required: true }]}
                >
                    <Input />
                </Form.Item>
                <Form.Item
                    name="shortname"
                    label="Shortname"
                    rules={[{ required: true }]}
                >
                    <Input />
                </Form.Item>
                <Form.Item
                    name='Organisation Logo'
                >
                    <ImgCrop rotationSlider>
                        <Upload
                            name="avatar"
                            listType="picture-card"
                            beforeUpload={beforeUpload}
                            onPreview={() => void handlePreview}
                            fileList={fileList}
                        >
                            {fileList.length >= 1 ? null : (
                                <div>
                                    <PlusOutlined />
                                    <div style={{ marginTop: 8 }}>Upload</div>
                                </div>
                            )}
                        </Upload>
                    </ImgCrop>
                </Form.Item>
            </Form>
        </Modal>
    </div>);
};
