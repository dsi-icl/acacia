import { FunctionComponent, useState } from 'react';
import css from './domains.module.css';
import { trpc } from '../../utils/trpc';
import { List, Table, Image, ColorPicker, Button, Modal, Form, Input, Upload, notification, message } from 'antd';
import LoadSpinner from '../reusable/loadSpinner';
import { RcFile, UploadFile } from 'antd/es/upload';
import { DeleteOutlined, PlusOutlined, SmileOutlined } from '@ant-design/icons';
import { convertFileListToApiFormat, getBase64 } from '../../utils/tools';
import ImgCrop from 'antd-img-crop';
import axios from 'axios';


export const DomainSection: FunctionComponent = () => {
    const getDomains = trpc.domain.getDomains.useQuery({});
    const [api, contextHolder] = notification.useNotification();
    const deleteDomain = trpc.domain.deleteDomain.useMutation({
        onSuccess: (() => {
            api.open({
                message: 'Domain has been deleted',
                description: '',
                duration: 10,
                icon: <SmileOutlined style={{ color: '#108ee9' }} />
            });
        })
    });
    if (getDomains.isLoading) {
        return <LoadSpinner />;
    }
    if (getDomains.isError) {
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
        title: 'Path',
        dataIndex: 'path',
        key: 'path',
        ellipsis: true,
        render: (__unused__value, record) => {
            return <div>{record.domainPath}</div>;
        }
    }, {
        title: 'Logo',
        dataIndex: 'logo',
        key: 'logo',
        render: (__unused__value, record) => {
            return <div><Image
                width={200}
                src={record.logo ? `${window.location.origin}/file/${record.logo}` : undefined}
            /></div>;
        }
    }, {
        title: 'Color',
        dataIndex: 'color',
        key: 'color',
        ellipsis: true,
        render: (__unused__value, record) => {
            return <div><ColorPicker defaultValue={record.color} disabled={true} /></div>;
        }
    }, {
        render: (__unused__value, record) => {
            return <DeleteOutlined onClick={() => deleteDomain.mutate({ domainId: record.id })} />;
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
                            <div>List of Domains</div>
                        </div>
                    </div>
                    <div>
                        <DomainCreation />
                    </div>
                </div>
            }
        >
            <Table
                dataSource={getDomains.data}
                columns={columns}
            >

            </Table>
        </List>
    </div>);
};

export const DomainCreation: FunctionComponent = () => {
    const [isModalOn, setIsModalOn] = useState<boolean>(false);
    const [domainColor, setDomainColor] = useState<string>('#FFFFFF');
    const [form] = Form.useForm();
    const [fileList, setFileList] = useState<RcFile[]>([]);

    const handleCreateDomain = async (variables: Record<string, string>) => {
        try {
            const files = await convertFileListToApiFormat(fileList, 'logo');
            const formData = new FormData();
            if (files.length > 0) {
                files.forEach(file => {
                    formData.append('logo', file.stream, file.originalname);
                });
            }

            Object.entries(variables).forEach(([key, value]) => {
                variables[key] && formData.append(key, String(value));
            });

            const response = await axios.post('/trpc/domain.createDomain', formData, {
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
                    name="domainName"
                    label="Domain Name"
                    rules={[{ required: true }]}
                >
                    <Input />
                </Form.Item>
                <Form.Item
                    name="domainPath"
                    label="Domain Path"
                    rules={[{ required: true }]}
                >
                    <Input />
                </Form.Item>
                <Form.Item
                    name='Domain Logo'
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
                <Form.Item
                    name="color"
                    label="Domain Color"
                    rules={[{ required: false }]}
                >
                    <ColorPicker defaultValue={domainColor ?? '#FFFFFF'} onChange={(_, hex) => setDomainColor(hex)} />
                </Form.Item>
            </Form>
        </Modal>
    </div>);
};
