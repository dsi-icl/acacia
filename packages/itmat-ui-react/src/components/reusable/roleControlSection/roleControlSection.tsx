import { FunctionComponent, useState } from 'react';
import { IRole, enumStudyRoles } from '@itmat-broker/itmat-types';
import { trpc } from '../../../utils/trpc';
import { Button, Checkbox, Form, Input, Modal, Select, Table, message } from 'antd';
import { useForm } from 'antd/es/form/Form';
import { SubsectionWithComment } from '../subsection/subsection';
import { MinusOutlined, PlusOutlined } from '@ant-design/icons';

const { Column } = Table;

export const RoleControlSection: FunctionComponent<{ studyId: string }> = ({ studyId }) => {
    const getStudyRoles = trpc.role.getStudyRoles.useQuery({ studyId });

    if (getStudyRoles.isLoading) {
        return <p>Loading...</p>;
    }

    if (getStudyRoles.isError) {
        return <p>An error occurred</p>;
    }

    const columns = [{
        title: 'Role Name',
        dataIndex: 'name',
        key: 'name',
        render: (_, record) => {
            return record.name;
        }
    }, {
        title: 'Description',
        dataIndex: 'description',
        key: 'description',
        render: (_, record) => {
            return record.description;
        }
    }, {
        title: 'Number of Users',
        dataIndex: 'users',
        key: 'users',
        render: (_, record) => {
            return record.users.length;
        }
    }, {
        title: '',
        dataIndex: 'action',
        key: 'action',
        render: (_, record) => {
            return <EditRoleComponent role={record} />;
        }
    }];

    return <div>
        <SubsectionWithComment title='roles' comment={<CreateRoleComponent studyId={studyId} />}>
            <Table
                columns={columns}
                dataSource={getStudyRoles.data}
            >
            </Table>
        </SubsectionWithComment>
    </div>;
};

const CreateRoleComponent: React.FC<{ studyId: string }> = ({ studyId }) => {
    const [isModalOn, setIsModalOn] = useState(false);
    const getUsers = trpc.user.getUsers.useQuery({});
    const createStudyRole = trpc.role.createStudyRole.useMutation({
        onSuccess: () => {
            void message.success('Role created successfully');
        },
        onError: () => {
            void message.error('Failed to create role');
        }
    });

    const [form] = useForm();

    if (getUsers.isLoading) {
        return <p>Loading...</p>;
    }

    if (getUsers.isError) {
        return <p>An error occurred</p>;
    }

    const secondLevelColumns = [
        {
            title: 'Property',
            dataIndex: 'property',
            key: 'property',
            render: (_, record, index) => (
                <Form.Item name={[index, 'property']} noStyle>
                    <Input />
                </Form.Item>
            )
        },
        {
            title: 'Values',
            dataIndex: 'values',
            key: 'values',
            render: (_, record, index) => (
                <Form.Item name={[index, 'values']} noStyle>
                    <Select mode="tags" />
                </Form.Item>
            )
        }
    ];

    const firstLevelColumns = [
        {
            title: 'Fields',
            dataIndex: 'fields',
            key: 'fields',
            render: (_, record, index) => (
                <Form.Item name={[index, 'fields']} noStyle>
                    <Select mode="tags" />
                </Form.Item>
            )
        }, {
            title: 'Include Unversioned',
            dataIndex: 'includeUnversioned',
            key: 'includeUnversioned',
            render: (_, record, index) => (
                <Form.Item name={[index, 'includeUnversioned']} valuePropName="checked" noStyle>
                    <Checkbox />
                </Form.Item>
            )
        }, {
            title: 'Data Properties',
            dataIndex: 'dataProperties',
            key: 'dataProperties',
            render: (_, __, index) => (
                <Form.List name={[index, 'dataProperties']}>
                    {(fields, { add, remove }) => (
                        <Table
                            dataSource={fields}
                            pagination={false}
                            footer={() => (
                                <Button onClick={() => add({ property: undefined, values: [] })}>
                                    <PlusOutlined /> Add Data Properties
                                </Button>
                            )}
                        >
                            {secondLevelColumns.map((col) => (
                                <Column
                                    key={col.key}
                                    title={col.title}
                                    dataIndex={col.dataIndex}
                                    render={(value, row, secondIndex) => (
                                        <Form.Item
                                            name={[secondIndex, col.dataIndex]}
                                            noStyle
                                        >
                                            {col.render(value, row, secondIndex)}
                                        </Form.Item>
                                    )}
                                />
                            ))}
                            <Column
                                title="Action"
                                render={(_, __, secondIndex) => (
                                    <Button
                                        icon={<MinusOutlined />}
                                        shape="circle"
                                        onClick={() => remove(secondIndex)}
                                    />
                                )}
                            />
                        </Table>
                    )}
                </Form.List>
            )
        }, {
            title: 'Permission',
            dataIndex: 'permission',
            key: 'permission',
            render: (_, record, index) => (
                <Form.Item name={[index, 'permission']} noStyle>
                    <Select>
                        <Select.Option value={0}>No Access</Select.Option>
                        <Select.Option value={parseInt('100', 2)}>Read</Select.Option>
                        <Select.Option value={parseInt('110', 2)}>Write</Select.Option>
                        <Select.Option value={parseInt('111', 2)}>Admin</Select.Option>
                    </Select>
                </Form.Item>
            )
        }];



    return (
        <div>
            <Button onClick={() => setIsModalOn(true)}>Create Role</Button>
            <Modal
                open={isModalOn}
                onOk={() => {
                    form.submit();
                }}
                width="80%"
                onCancel={() => setIsModalOn(false)}
            >
                <Form
                    form={form}
                    onFinish={(values) => {
                        const variables = {
                            studyId: studyId,
                            name: values.name,
                            description: values.description,
                            dataPermissions: values.dataPermissions.map((el) => ({
                                fields: el.fields,
                                dataProperties: el.dataProperties.reduce((acc, curr) => {
                                    acc[curr.property] = curr.values;
                                    return acc;
                                }, {}),
                                includeUnVersioned: el.includeUnversioned,
                                permission: el.permission
                            })),
                            studyRole: values.studyRole,
                            users: values.users
                        };
                        void createStudyRole.mutate(variables);
                    }}
                >
                    <Form.Item
                        label="Role Name"
                        name="name"
                        rules={[{ required: true, message: 'Please input the role name' }]}
                    >
                        <Input />
                    </Form.Item>
                    <Form.Item
                        label="Description"
                        name="description"
                        rules={[{ message: 'Please input the role description' }]}
                    >
                        <Input />
                    </Form.Item>
                    <Form.Item
                        label='Study Role'
                        name='studyRole'
                        rules={[{ required: true, message: 'Please select the role' }]}
                    >
                        <Select>
                            {
                                Object.keys(enumStudyRoles).map(el => <Select.Option key={el} value={el}>{el}</Select.Option>)
                            }
                        </Select>
                    </Form.Item>
                    <Form.Item
                        label='Users'
                        name='users'
                    >
                        <Select mode='multiple' showSearch optionFilterProp='label'>
                            {
                                getUsers.data.map(el => <Select.Option key={el.id} value={el.id} label={`${el.firstname} ${el.lastname}`}>{`${el.firstname} ${el.lastname} ${el.username}`}</Select.Option>)
                            }
                        </Select>
                    </Form.Item>
                    <Form.List name="dataPermissions">
                        {(fields, { add, remove }) => (
                            <Table
                                pagination={false}
                                dataSource={fields}
                                footer={() => (
                                    <Button
                                        onClick={() =>
                                            add({
                                                fields: [],
                                                dataProperties: [],
                                                includeUnversioned: false,
                                                permission: 0
                                            })
                                        }
                                    >
                                        <PlusOutlined /> Add Data Permission
                                    </Button>
                                )}
                            >
                                {firstLevelColumns.map((col) => (
                                    <Column
                                        key={col.key}
                                        title={col.title}
                                        dataIndex={col.dataIndex}
                                        render={(value, row, index) => (
                                            <Form.Item
                                                name={[index, col.dataIndex]}
                                                valuePropName={
                                                    col.dataIndex === 'includeUnversioned'
                                                        ? 'checked'
                                                        : 'value'
                                                }
                                                noStyle
                                            >
                                                {col.render(value, row, index)}
                                            </Form.Item>
                                        )}
                                    />
                                ))}
                                <Column
                                    title="Action"
                                    render={(_, __, index) => (
                                        <Button
                                            icon={<MinusOutlined />}
                                            shape="circle"
                                            onClick={() => remove(index)}
                                        />
                                    )}
                                />
                            </Table>
                        )}
                    </Form.List>
                </Form>
            </Modal>
        </div>
    );
};

const EditRoleComponent: React.FC<{ role: IRole }> = ({ role }) => {
    const [isModalOn, setIsModalOn] = useState(false);
    const getUsers = trpc.user.getUsers.useQuery({});

    const editStudyRole = trpc.role.editStudyRole.useMutation({
        onSuccess: () => {
            void message.success('Role edited successfully');
        },
        onError: () => {
            void message.error('Failed to edit role');
        }
    });

    const [form] = useForm();

    if (getUsers.isLoading) {
        return <p>Loading...</p>;
    }

    if (getUsers.isError) {
        return <p>An error occurred</p>;
    }

    const secondLevelColumns = [{
        title: 'Property',
        dataIndex: 'property',
        key: 'property',
        render: (_, record, index) => (
            <Form.Item name={[index, 'property']} noStyle>
                <Input />
            </Form.Item>
        )
    }, {
        title: 'Values',
        dataIndex: 'values',
        key: 'values',
        render: (_, record, index) => (
            <Form.Item name={[index, 'values']} noStyle>
                <Select mode="tags" />
            </Form.Item>
        )
    }
    ];

    const firstLevelColumns = [{
        title: 'Fields',
        dataIndex: 'fields',
        key: 'fields',
        render: (_, record, index) => (
            <Form.Item name={[index, 'fields']} noStyle>
                <Select mode="tags" />
            </Form.Item>
        )
    }, {
        title: 'Include Unversioned',
        dataIndex: 'includeUnversioned',
        key: 'includeUnversioned',
        render: (_, record, index) => (
            <Form.Item name={[index, 'includeUnversioned']} valuePropName="checked" noStyle>
                <Checkbox />
            </Form.Item>
        )
    }, {
        title: 'Data Properties',
        dataIndex: 'dataProperties',
        key: 'dataProperties',
        render: (_, __, index) => (
            <Form.List name={[index, 'dataProperties']}>
                {(fields, { add, remove }) => (
                    <Table
                        dataSource={fields}
                        pagination={false}
                        footer={() => (
                            <Button onClick={() => add({ property: undefined, values: [] })}>
                                <PlusOutlined /> Add Data Properties
                            </Button>
                        )}
                    >
                        {secondLevelColumns.map((col) => (
                            <Column
                                key={col.key}
                                title={col.title}
                                dataIndex={col.dataIndex}
                                render={(value, row, secondIndex) => (
                                    <Form.Item
                                        name={[secondIndex, col.dataIndex]}
                                        noStyle
                                    >
                                        {col.render(value, row, secondIndex)}
                                    </Form.Item>
                                )}
                            />
                        ))}
                        <Column
                            title="Action"
                            render={(_, __, secondIndex) => (
                                <Button
                                    icon={<MinusOutlined />}
                                    shape="circle"
                                    onClick={() => remove(secondIndex)}
                                />
                            )}
                        />
                    </Table>
                )}
            </Form.List>
        )
    }, {
        title: 'Permission',
        dataIndex: 'permission',
        key: 'permission',
        render: (_, record, index) => (
            <Form.Item name={[index, 'permission']} noStyle>
                <Select>
                    <Select.Option value={0}>No Access</Select.Option>
                    <Select.Option value={parseInt('100', 2)}>Read</Select.Option>
                    <Select.Option value={parseInt('110', 2)}>Write</Select.Option>
                    <Select.Option value={parseInt('111', 2)}>Admin</Select.Option>
                </Select>
            </Form.Item>
        )
    }];

    return (
        <div>
            <Button onClick={() => setIsModalOn(true)}>Edit Role</Button>
            <Modal
                open={isModalOn}
                onOk={() => {
                    form.submit();
                }}
                width="80%"
                onCancel={() => setIsModalOn(false)}
            >
                <Form
                    form={form}
                    initialValues={(() => {
                        return {
                            name: role.name,
                            description: role.description,
                            dataPermissions: role.dataPermissions.map((el) => ({
                                fields: el.fields,
                                dataProperties: Object.keys(el.dataProperties).map((key) => ({
                                    property: key,
                                    values: el.dataProperties[key]
                                })),
                                includeUnversioned: el.includeUnVersioned,
                                permission: el.permission
                            })),
                            studyRole: role.studyRole,
                            users: role.users
                        };
                    })()}
                    onFinish={(values) => {
                        const variables = {
                            roleId: role.id,
                            name: values.name,
                            description: values.description ?? undefined,
                            dataPermissions: values.dataPermissions.map((el) => ({
                                fields: el.fields,
                                dataProperties: el.dataProperties.reduce((acc, curr) => {
                                    acc[curr.property] = curr.values;
                                    return acc;
                                }, {}),
                                includeUnVersioned: el.includeUnversioned,
                                permission: el.permission
                            })),
                            studyRole: values.studyRole,
                            users: values.users
                        };
                        void editStudyRole.mutate(variables);
                    }}
                >
                    <Form.Item
                        label="Role Name"
                        name="name"
                        rules={[{ required: true, message: 'Please input the role name' }]}
                    >
                        <Input />
                    </Form.Item>
                    <Form.Item
                        label="Description"
                        name="description"
                        rules={[{ message: 'Please input the role description' }]}
                    >
                        <Input />
                    </Form.Item>
                    <Form.Item
                        label='Study Role'
                        name='studyRole'
                        rules={[{ required: true, message: 'Please select the role' }]}
                    >
                        <Select>
                            {
                                Object.keys(enumStudyRoles).map(el => <Select.Option key={el} value={el}>{el}</Select.Option>)
                            }
                        </Select>
                    </Form.Item>
                    <Form.Item
                        label='Users'
                        name='users'
                    >
                        <Select mode='multiple' showSearch optionFilterProp='label'>
                            {
                                getUsers.data.map(el => <Select.Option key={el.id} value={el.id} label={`${el.firstname} ${el.lastname}`}>{`${el.firstname} ${el.lastname} ${el.username}`}</Select.Option>)
                            }
                        </Select>
                    </Form.Item>
                    <Form.List name="dataPermissions">
                        {(fields, { add, remove }) => (
                            <Table
                                pagination={false}
                                dataSource={fields}
                                footer={() => (
                                    <Button
                                        onClick={() =>
                                            add({
                                                fields: [],
                                                dataProperties: [],
                                                includeUnversioned: false,
                                                permission: 0
                                            })
                                        }
                                    >
                                        <PlusOutlined /> Add Data Permission
                                    </Button>
                                )}
                            >
                                {firstLevelColumns.map((col) => (
                                    <Column
                                        key={col.key}
                                        title={col.title}
                                        dataIndex={col.dataIndex}
                                        render={(value, row, index) => (
                                            <Form.Item
                                                name={[index, col.dataIndex]}
                                                valuePropName={
                                                    col.dataIndex === 'includeUnversioned'
                                                        ? 'checked'
                                                        : 'value'
                                                }
                                                noStyle
                                            >
                                                {col.render(value, row, index)}
                                            </Form.Item>
                                        )}
                                    />
                                ))}
                                <Column
                                    title="Action"
                                    render={(_, __, index) => (
                                        <Button
                                            icon={<MinusOutlined />}
                                            shape="circle"
                                            onClick={() => remove(index)}
                                        />
                                    )}
                                />
                            </Table>
                        )}
                    </Form.List>
                </Form>
            </Modal>
        </div>
    );
};

