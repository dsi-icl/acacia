import { FunctionComponent, useState } from 'react';
import { Mutation } from '@apollo/client/react/components';
import { useQuery, useMutation } from '@apollo/client/react/hooks';
import { ADD_NEW_ROLE, EDIT_ROLE, REMOVE_ROLE, GET_USERS, GET_PROJECT, GET_STUDY, GET_ORGANISATIONS } from '@itmat-broker/itmat-models';
import { IRoleQL, IUser, atomicOperation, IPermissionManagementOptions } from '@itmat-broker/itmat-types';
import LoadSpinner from '../loadSpinner';
import css from './roleControlSection.module.css';
import { Tag, Select, Button, Form, Input, Alert, Popconfirm, Checkbox, Collapse, Divider, Table, Col, Row } from 'antd';
import { PlusOutlined, DeleteOutlined, MinusCircleOutlined } from '@ant-design/icons';
const { Panel } = Collapse;

type RoleControlSectionProps = {
    studyId: string;
    projectId?: string;
    roles: IRoleQL[];
}

export const RoleControlSection: FunctionComponent<RoleControlSectionProps> = ({
    roles,
    studyId,
    projectId
}) => {
    return (
        <>
            <AddRole studyId={studyId} projectId={projectId} />
            <br />
            <Collapse>
                {roles.map((el, index) =>
                    <Panel header={el.name} key={`role-${index}`}>
                        <RoleDescriptor
                            key={el.id}
                            role={el}
                        />
                    </Panel>
                )}
            </Collapse>
        </>
    );
};

export default RoleControlSection;

type RoleDescriptorProps = {
    role: IRoleQL;
}

export const RoleDescriptor: FunctionComponent<RoleDescriptorProps> = ({
    role
}) => {
    const isStudyRole = !role.projectId;
    const { data: userData, loading: userFetchLoading } = useQuery(GET_USERS, { variables: { fetchDetailsAdminOnly: false, fetchAccessPrivileges: false } });
    const [removeRole, { loading: removeRoleLoading }] = useMutation(REMOVE_ROLE, { refetchQueries: [{ query: isStudyRole ? GET_STUDY : GET_PROJECT, variables: isStudyRole ? { studyId: role.studyId } : { projectId: role.projectId, admin: true } }] });

    if (userFetchLoading) { return <LoadSpinner />; }
    return (
        <div className={css.one_role}>
            <div className={css.role_header}>
                <label className={css.role_name}>{role.name}</label>
                {removeRoleLoading
                    ? <span className={css.right_aligned}>
                        <LoadSpinner />
                    </span>
                    : <div className={css.right_aligned}>
                        <Popconfirm title={<>Are you sure about deleting role <i>{role.name}</i>?</>} onConfirm={async () => removeRole({ variables: { roleId: role.id } })} okText='Yes' cancelText='No'>
                            <Button icon={<DeleteOutlined />} danger ></Button>
                        </Popconfirm>
                    </div>
                }
            </div>
            <br />
            <PermissionsControlPanel
                role={role}
            />
            <br />
            <br />
            <label>Users with this role: </label>
            <br />
            <UsersControlPanel
                roleId={role.id}
                studyId={role.studyId}
                projectId={role.projectId}
                availableUserList={userData.getUsers}
                originallySelectedUsers={role.users}
                permissions={role.permissions}
            />
        </div>
    );
};

type AddRoleProps = {
    studyId: string;
    projectId?: string;
}

export const AddRole: FunctionComponent<AddRoleProps> = ({
    studyId,
    projectId
}) => {

    const [isExpanded, setIsExpanded] = useState(false);
    const [addNewRole, {
        data: createRoleData,
        loading: createRoleLoading,
        error: createRoleError
    }] = useMutation(ADD_NEW_ROLE, {
        onCompleted: () => { setIsExpanded(false); },
        refetchQueries: projectId ? [{
            query: GET_PROJECT,
            variables: {
                projectId,
                admin: true
            }
        }] : [{
            query: GET_STUDY,
            variables: {
                studyId,
                admin: true
            }
        }],
        onError: () => { return; }
    });

    if (!isExpanded)
        return (
            <>
                <Button icon={<PlusOutlined />} type='dashed' onClick={() => setIsExpanded(true)}>Add new role</Button>
                <br />
            </>
        );

    return (
        <div className={css.add_new_role_section}>
            <Form onFinish={async (variables) => addNewRole({
                variables: {
                    ...variables,
                    studyId,
                    projectId
                }
            })}>
                <Form.Item name='roleName' >
                    <Input placeholder='Role name' />
                </Form.Item>
                {createRoleError ? (
                    <>
                        <Alert type='error' message={createRoleError?.graphQLErrors.map(error => error.message).join()} />
                        <br />
                    </>
                ) : null}
                {createRoleData?.successful ? (
                    <>
                        <Alert type='success' message={'All Saved!'} />
                        <br />
                    </>
                ) : null}
                <Form.Item>
                    <Button onClick={() => setIsExpanded(false)}>
                        Cancel
                    </Button>
                    &nbsp;&nbsp;&nbsp;
                    <Button type='primary' disabled={createRoleLoading} loading={createRoleLoading} htmlType='submit'>
                        Create
                    </Button>
                </Form.Item>
            </Form>
        </div>
    );
};

type PermissionsControlPanelProps = {
    role: IRoleQL
}

const PermissionsControlPanel: FunctionComponent<PermissionsControlPanelProps> = ({
    role
}) => {
    const filterColumns = function (remove) {
        return [
            {
                title: 'Field',
                width: '50%',
                dataIndex: 'field',
                key: 'field',
                align: 'center' as const,
                render: (__unused__value, __unused__record, index) => {
                    return (
                        <Form.Item
                            name={[index, 'field']}
                            rules={[
                                {
                                    required: true
                                }
                            ]}
                        >
                            <Input placeholder='Input Field' />
                        </Form.Item>
                    );
                }
            },
            {
                title: 'Op',
                width: '20%',
                dataIndex: 'op',
                key: 'op',
                align: 'center' as const,
                render: (__unused__value, __unused__record, index) => {
                    return (
                        <Form.Item
                            name={[index, 'op']}
                            rules={[{ required: true }]}
                        >
                            <Select
                                placeholder={'Select Operation'}
                                getPopupContainer={trigger => trigger.parentElement}
                            >
                                {
                                    ops.map(el => {
                                        return <Select.Option value={el}>{el}</Select.Option>;
                                    })
                                }
                            </Select>
                        </Form.Item>
                    );
                }
            },
            {
                title: 'Threshold',
                width: '20%',
                dataIndex: 'threshold',
                key: 'threshold',
                align: 'center' as const,
                render: (__unused__value, __unused__record, index) => {
                    return (
                        <Form.Item
                            name={[index, 'value']}
                            rules={[
                                {
                                    required: true
                                }
                            ]}
                        >
                            <Input placeholder='Input threshold' />
                        </Form.Item>
                    );
                }
            },
            {
                title: 'Delete',
                width: '10%',
                dataIndex: 'delete',
                key: 'delete',
                align: 'center' as const,
                render: (__unused__value, record) => {
                    return (
                        <MinusCircleOutlined onClick={() => remove(record.name)} />
                    );
                }
            }
        ];
    };
    return (
        <Mutation<any, any>
            mutation={EDIT_ROLE}
        // onCompleted={() => setSavedSuccessfully(true)}
        >
            {(submit, { loading, error }) =>
                <Form title='EditUserForm' initialValues={{
                    ...role.permissions.data,
                    ...role.permissions.manage,
                    description: role.description
                }} layout='vertical' onFinish={async (variables) => submit({
                    variables: {
                        roleId: role.id,
                        permissionChanges: {
                            data: {
                                subjectIds: variables.subjectIds,
                                visitIds: variables.visitIds,
                                fieldIds: variables.fieldIds,
                                uploaders: variables.uploaders,
                                hasVersioned: variables.hasVersioned,
                                operations: variables.operations,
                                filters: variables.filters
                            },
                            manage: {
                                own: variables.own,
                                role: variables.role,
                                job: variables.job,
                                query: variables.query,
                                ontologyTrees: variables.ontologyTrees
                            }
                        },
                        description: variables.description
                    }
                })}>
                    <div>
                        <div>
                            <Form.Item name='description' label='Description'>
                                <Input />
                            </Form.Item>
                        </div>
                        <div className={css.data_permissions}>
                            <Divider orientation='left'>Data Permissions</Divider>
                            <Row gutter={16}>
                                <Col span={5}>
                                    <Form.Item name='subjectIds' label='Subject Id'>
                                        <Select
                                            mode='tags'
                                            tokenSeparators={[',']}
                                        />
                                    </Form.Item>
                                </Col>
                                <Col span={5}>
                                    <Form.Item name='visitIds' label='Visit Id'>
                                        <Select
                                            mode='tags'
                                            tokenSeparators={[',']}
                                        />
                                    </Form.Item>
                                </Col>
                                <Col span={5}>
                                    <Form.Item name='fieldIds' label='Field Id'>
                                        <Select
                                            mode='tags'
                                            tokenSeparators={[',']}
                                        />
                                    </Form.Item>
                                </Col>
                                <Col span={5}>
                                    <Form.Item name='uploaders' label='Uploaders'>
                                        <Select
                                            mode='tags'
                                            tokenSeparators={[',']}
                                        />
                                    </Form.Item>
                                </Col>
                                <Col span={5}>
                                    <Form.Item name='operations' label='Operations'>
                                        <Checkbox.Group
                                            options={Object.keys(atomicOperation).map(el => {
                                                return { label: el, value: atomicOperation[el] };
                                            })}
                                        />
                                    </Form.Item>
                                </Col>
                                <Col span={4}>
                                    <Form.Item name='hasVersioned' label='Include UnVersioned Data' valuePropName="checked">
                                        <Checkbox />
                                    </Form.Item>
                                </Col>
                            </Row>
                            <Form.List name='filters'>
                                {(filters, { add, remove }) => {
                                    return (
                                        <div>
                                            <Divider plain>Variable Filter <PlusOutlined onClick={() => add()} /></Divider>
                                            {
                                                filters.length > 0 ?
                                                    <Table
                                                        scroll={{ x: 'max-content' }}
                                                        pagination={false}
                                                        columns={filterColumns(remove)}
                                                        dataSource={filters}
                                                        size='middle'
                                                    ></Table>
                                                    :
                                                    null
                                            }
                                        </div>
                                    );
                                }}
                            </Form.List>
                        </div>
                        <div className={css.management_permissions}>
                            <Divider orientation='left'>Management Permissions</Divider>
                            <Row gutter={16}>
                                <Col span={4}>
                                    <div>
                                        <Form.Item name={IPermissionManagementOptions.own} label='Self Management'>
                                            <Checkbox.Group
                                                options={Object.keys(atomicOperation).map(el => {
                                                    return { label: el, value: atomicOperation[el] };
                                                })}
                                            />
                                        </Form.Item>
                                    </div>
                                </Col>
                                <Col span={4}>
                                    <div>
                                        <Form.Item name={IPermissionManagementOptions.role} label='Role Management'>
                                            <Checkbox.Group
                                                options={Object.keys(atomicOperation).map(el => {
                                                    return { label: el, value: atomicOperation[el] };
                                                })}
                                            />
                                        </Form.Item>
                                    </div>
                                </Col>
                                <Col span={4}>
                                    <div>
                                        <Form.Item name={IPermissionManagementOptions.job} label='Job Management'>
                                            <Checkbox.Group
                                                options={Object.keys(atomicOperation).map(el => {
                                                    return { label: el, value: atomicOperation[el] };
                                                })}
                                            />
                                        </Form.Item>
                                    </div>
                                </Col>
                                <Col span={4}>
                                    <div>
                                        <Form.Item name={IPermissionManagementOptions.query} label='Query Management'>
                                            <Checkbox.Group
                                                options={Object.keys(atomicOperation).map(el => {
                                                    return { label: el, value: atomicOperation[el] };
                                                })}
                                            />
                                        </Form.Item>
                                    </div>
                                </Col>
                                <Col span={4}>
                                    <div>
                                        <Form.Item name={IPermissionManagementOptions.ontologyTrees} label='OntologyTree Management'>
                                            <Checkbox.Group
                                                options={Object.keys(atomicOperation).map(el => {
                                                    return { label: el, value: atomicOperation[el] };
                                                })}
                                            />
                                        </Form.Item>
                                    </div>
                                </Col>
                            </Row>
                        </div>
                        <Button type='primary' disabled={loading} loading={loading} htmlType='submit'>
                            Save
                        </Button>
                        {error ? (
                            <>
                                <Alert type='error' message={error.graphQLErrors.map(error => error.message).join()} />
                                <br />
                            </>
                        ) : null}
                        {loading ? (
                            <LoadSpinner />
                        ) : null}
                    </div>
                </Form>
            }

        </Mutation>
    );
};

type UsersControlPanelProps = {
    roleId: string;
    studyId: string;
    projectId?: string;
    availableUserList: IUser[];
    originallySelectedUsers: IUser[];
    permissions: any;
}

const UsersControlPanel: FunctionComponent<UsersControlPanelProps> = ({
    roleId,
    availableUserList,
    originallySelectedUsers,
    permissions
}) => {

    const [editUsers, { loading }] = useMutation(EDIT_ROLE);
    const { loading: getOrgsLoading, error: getOrgsError, data: getOrgsData } = useQuery(GET_ORGANISATIONS);

    const handleSelect = async (value: string) => {
        return editUsers({
            variables: {
                roleId,
                userChanges: {
                    add: [value],
                    remove: []
                },
                permissionChanges: permissions
            }
        });
    };

    const handleDeselect = async (value: string) => {
        return editUsers({
            variables: {
                roleId,
                userChanges: {
                    add: [],
                    remove: [value]
                },
                permissionChanges: permissions
            }
        });
    };

    const handleFilter = (value: string, option: any) => {
        const searchTerm = value?.trim()?.toLocaleLowerCase();
        const user = availableUserList.filter(user => user.id === option.value)?.[0];
        if (!user || !searchTerm || searchTerm === '')
            return false;
        return user.firstname.toLocaleLowerCase().includes(value)
            || user.lastname.toLocaleLowerCase().includes(value);
    };

    const tagRender = (props) => {

        const { label, value, onClose } = props;

        return (
            <Tag
                style={{
                    marginRight: 3
                }}
                closable
                onClose={() => {
                    editUsers({
                        variables: {
                            roleId,
                            userChanges: {
                                add: [],
                                remove: [value]
                            },
                            permissionChanges: permissions
                        }
                    }).then(() => {
                        onClose();
                    });
                }}
            >
                {label}
            </Tag>
        );
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

    return (
        <Select<any>
            mode='multiple'
            loading={loading}
            style={{ width: '100%' }}
            placeholder='Add users to this role'
            tokenSeparators={[',', ';']}
            value={originallySelectedUsers.map(user => user.id)}
            filterOption={handleFilter}
            onSelect={handleSelect}
            onDeselect={handleDeselect}
            tagRender={tagRender}
        >
            {
                availableUserList.map((user, index) => (
                    <Select.Option key={index} value={user.id}>
                        {user.firstname} {user.lastname} {sites[user.organisation] ? `(${sites[user.organisation]})` : ''}
                    </Select.Option>
                ))
            }
        </Select >
    );
};

const ops: string[] = ['=', '!=', '<', '>', '>=', '<='];
