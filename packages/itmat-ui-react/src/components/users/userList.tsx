import { FunctionComponent, useState } from 'react';
import { Button, DatePicker, Form, Input, List, Modal, Progress, Select, Table, message } from 'antd';
import 'react-quill/dist/quill.snow.css';
import { trpc } from '../../utils/trpc';
import LoadSpinner from '../reusable/loadSpinner';
import { stringCompareFunc } from '../../utils/tools';
import css from './users.module.css';
import { ISystemConfig, defaultSettings, enumConfigType, enumUserTypes } from '@itmat-broker/itmat-types';
import dayjs from 'dayjs';
import weekday from 'dayjs/plugin/weekday';
import Highlighter from 'react-highlight-words';

dayjs.extend(weekday);


const { Option } = Select;

export const UserListSection: FunctionComponent = () => {
    const [searchedKeyword, setSearchedKeyword] = useState<string | undefined>(undefined);
    const getUsers = trpc.user.getUsers.useQuery({});
    const getSystemConfig = trpc.config.getConfig.useQuery({ configType: enumConfigType.SYSTEMCONFIG, key: null, useDefault: true });
    const getOrganisations = trpc.organisation.getOrganisations.useQuery({});
    const editUser = trpc.user.editUser.useMutation({
        onSuccess: () => {
            void message.success('User edited.');
        },
        onError: () => {
            void message.error('Failed to edit this user.');
        }
    });
    const [isModalOn, setIsModalOn] = useState(false);
    const [form] = Form.useForm();
    if (getUsers.isLoading || getSystemConfig.isLoading || getOrganisations.isLoading) {
        return <>
            <div className='page_ariane'>Loading...</div>
            <div className='page_content'>
                <LoadSpinner />
            </div>
        </>;
    }
    if (getUsers.isError || getSystemConfig.isError || getOrganisations.isError) {
        return <>
            An error occured.
        </>;
    }

    const systemConfig: ISystemConfig = getSystemConfig.data ? getSystemConfig.data.properties as ISystemConfig : defaultSettings.systemConfig;
    const columns = [{
        title: 'First Name',
        dataIndex: 'firstname',
        key: 'firstname',
        ellipsis: true,
        width: '8%',
        sorter: (a, b) => { return stringCompareFunc(a.firstname, b.firstname); },
        render: (__unused__value, record) => {
            if (searchedKeyword)
                return <Highlighter searchWords={[searchedKeyword]} textToHighlight={record.firstname} highlightStyle={{
                    backgroundColor: '#FFC733',
                    padding: 0
                }} />;
            else
                return record.firstname;
        }
    }, {
        title: 'Last Name',
        dataIndex: 'lastname',
        key: 'lastname',
        ellipsis: true,
        width: '8%',
        sorter: (a, b) => { return stringCompareFunc(a.lastname, b.lastname); },
        render: (__unused__value, record) => {
            if (searchedKeyword)
                return <Highlighter searchWords={[searchedKeyword]} textToHighlight={record.lastname} highlightStyle={{
                    backgroundColor: '#FFC733',
                    padding: 0
                }} />;
            else
                return record.lastname;
        }
    }, {
        title: 'Username',
        dataIndex: 'username',
        key: 'username',
        ellipsis: true,
        width: '10%',
        sorter: (a, b) => { return stringCompareFunc(a.username, b.username); },
        render: (__unused__value, record) => {
            if (searchedKeyword)
                return <Highlighter searchWords={[searchedKeyword]} textToHighlight={record.username} highlightStyle={{
                    backgroundColor: '#FFC733',
                    padding: 0
                }} />;
            else
                return record.username;
        }
    }, {
        title: 'Email',
        dataIndex: 'email',
        key: 'email',
        ellipsis: true,
        width: '10%',
        sorter: (a, b) => { return stringCompareFunc(a.email, b.email); },
        render: (__unused__value, record) => {
            if (searchedKeyword)
                return <Highlighter searchWords={[searchedKeyword]} textToHighlight={record.email} highlightStyle={{
                    backgroundColor: '#FFC733',
                    padding: 0
                }} />;
            else
                return record.email;
        }
    }, {
        title: 'Organisation',
        dataIndex: 'organisation',
        key: 'organisation',
        ellipsis: true,
        width: '10%',
        sorter: (a, b) => {
            const trans = (orgId) => {
                const org = getOrganisations.data.filter(el => el.id === orgId)[0];
                return org ? org.name : 'NA';
            };
            return stringCompareFunc(trans(a.organisation), trans(b.organisation));
        },
        render: (__unused__value, record) => {
            const org = getOrganisations.data.filter(el => el.id === record.organisation)[0];
            return org ? org.name : 'NA';
        }
    }, {
        title: 'Registered At',
        dataIndex: 'registeredAt',
        key: 'registeredAt',
        ellipsis: true,
        width: '10%',
        sorter: (a, b) => a.life.createdTime - b.life.createdTime,
        render: (__unused__value, record) => {
            return (new Date(record.life.createdTime)).toLocaleDateString();
        }
    }, {
        title: 'Expired At',
        dataIndex: 'expiredAt',
        key: 'expiredAt',
        ellipsis: true,
        width: '24%', // Adjust the width as needed
        sorter: (a, b) => {
            if (a.type === enumUserTypes.ADMIN && b.type === enumUserTypes.ADMIN) {
                return b.firstname.localeCompare(a.firstname);
            } else if (a.type === enumUserTypes.ADMIN && b.type !== enumUserTypes.ADMIN) {
                return 1;
            } else if (a.type !== enumUserTypes.ADMIN && b.type === enumUserTypes.ADMIN) {
                return -1;
            } else {
                return a.expiredAt - b.expiredAt;
            }
        },
        render: (__unused__value, record) => {
            const progressInfo = getProgressStatusAndPercent(record.type === enumUserTypes.ADMIN, systemConfig.defaultUserExpireDays, record.expiredAt);
            return (
                <div style={{ width: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {
                        progressInfo.status !== 'exception' ?
                            <Progress
                                percent={progressInfo.percent}
                                status={progressInfo.status}
                                format={() => ''}
                                style={{ width: '70%', float: 'left' }} // Adjust the width to fit the text and progress bar within the cell
                            /> : <span style={{ width: '70%', float: 'left', color: 'grey' }}>Expired</span>
                    }
                    < span style={{ float: 'left', marginLeft: '5px' }}>
                        {record.type === enumUserTypes.ADMIN ? 'Infinite' : dayjs(record.expiredAt).format('DD/MM/YYYY')}
                    </span >
                </div >
            );
        }
    }, {
        title: 'Edit',
        dataIndex: 'edit',
        key: 'edit',
        ellipsis: true,
        width: '5%', // Adjust the width as needed
        render: (__unused__value, record) => {
            return <Button onClick={() => {
                setIsModalOn(true);
                form.setFieldsValue({
                    ...record,
                    expiredAt: dayjs(record.expiredAt)
                });
            }}>Edit</Button>;
        }
    }
    ];
    return (
        <div className={css.page_container}>
            <List
                header={
                    <div className={css['overview-header']} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div className={css['overview-header']} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                <div className={css['overview-icon']}></div>
                                <div style={{ marginRight: '20px' }}>List of Users</div>
                                <div>
                                    <Input value={searchedKeyword} placeholder='Search' onChange={(e) => setSearchedKeyword(e.target.value)} />
                                </div>
                            </div>
                        </div>
                        <div>
                            <span>{`Active Users: ${getUsers.data.filter(el =>
                                (!el.expiredAt || (el.expiredAt && el.expiredAt > Date.now()))).length}/${getUsers.data.length}`}</span>
                        </div>
                    </div>
                }
            >
                <List.Item>
                    <Modal
                        open={isModalOn}
                        onOk={() => {
                            setIsModalOn(false);
                            const values = form.getFieldsValue();
                            editUser.mutate({
                                userId: values.id,
                                username: values.username,
                                type: undefined,
                                firstname: values.firstname,
                                lastname: values.lastname,
                                email: values.email,
                                expiredAt: dayjs(values.expiredAt).valueOf()
                            });
                        }}
                        onCancel={() => {
                            setIsModalOn(false);
                            form.setFieldsValue({});
                        }}
                    >
                        <Form
                            form={form}
                        >
                            <Form.Item
                                name='id'
                            >
                            </Form.Item>
                            <Form.Item
                                name='firstname'
                                label='First Name'
                            >
                                <Input />
                            </Form.Item>
                            <Form.Item
                                name='lastname'
                                label='Last Name'
                            >
                                <Input />
                            </Form.Item>
                            <Form.Item
                                name='username'
                                label='User Name'
                            >
                                <Input />
                            </Form.Item>
                            <Form.Item
                                name='email'
                                label='Email'
                            >
                                <Input />
                            </Form.Item>
                            <Form.Item
                                name='organisation'
                                label='Organisation'
                            >
                                <Select>
                                    {getOrganisations.data.map(el => <Option value={el.id}>{el.name}</Option>)}
                                </Select>
                            </Form.Item>
                            <Form.Item
                                // valuePropName='date'
                                name='expiredAt'
                                label='Expired On'
                            >
                                <DatePicker
                                    disabledDate={(current) =>
                                        current && (current < dayjs().endOf('day') || current > dayjs().add(systemConfig.defaultUserExpireDays, 'day'))
                                    }
                                />
                            </Form.Item>
                        </Form>
                    </Modal>
                    <Table
                        dataSource={getUsers.data.filter(el => {
                            const keyword = searchedKeyword ? searchedKeyword.toLowerCase() : '';
                            return el.firstname.toLowerCase().includes(keyword)
                                || el.lastname.toLowerCase().includes(keyword)
                                || el.username.toLowerCase().includes(keyword)
                                || el.email.toLowerCase().includes(keyword);
                        })}
                        columns={columns}
                        pagination={
                            {
                                defaultPageSize: 50,
                                showSizeChanger: true,
                                pageSizeOptions: ['50', '100'],
                                defaultCurrent: 1,
                                showQuickJumper: true
                            }
                        }
                    />
                </List.Item>
            </List>
        </div>
    );
};

const getProgressStatusAndPercent = (isAdmin, maximumDays, expiredAt) => {
    const now = Date.now();
    const upperLimit = maximumDays * 24 * 60 * 60 * 1000; // 90 days in milliseconds
    const minimumLength = 0; // Minimum length for expired items

    // Calculate time left until expiration
    const timeLeft = expiredAt - now;
    // Calculate percentage
    let percent;
    if (timeLeft < 0) {
        // Already expired
        percent = minimumLength;
    } else if (timeLeft > upperLimit) {
        percent = 100;
    } else {
        // Calculate the percentage based on the time left, with 100% being the upper limit (90 days)
        percent = 0 + (timeLeft / upperLimit) * 100;
        percent = Math.min(percent, 100); // Ensure the percent does not exceed 100
    }

    if (isAdmin) {
        percent = 101;
    }

    // Determine the status based on the percent
    let status;
    if (percent === minimumLength) {
        status = 'exception'; // Expired
    } else if (percent < 50) {
        status = 'active'; // Expiring soon
    } else {
        status = 'success'; // Safe
    }


    return { percent, status };
};
