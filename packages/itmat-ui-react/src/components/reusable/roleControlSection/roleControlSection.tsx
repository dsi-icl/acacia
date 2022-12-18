import { FunctionComponent, useState } from 'react';
import { Mutation } from '@apollo/client/react/components';
import { useQuery, useMutation } from '@apollo/client/react/hooks';
import { ADD_NEW_ROLE, EDIT_ROLE, REMOVE_ROLE, GET_USERS, GET_PROJECT, GET_STUDY, GET_ORGANISATIONS } from '@itmat-broker/itmat-models';
import { IRoleQL, IUser, permissions, permissionLabels, atomicOperation } from '@itmat-broker/itmat-types';
import LoadSpinner from '../loadSpinner';
import css from './roleControlSection.module.css';
import { Tag, Select, Button, Form, Input, Alert, Popconfirm, Checkbox, Collapse } from 'antd';
import { LoadingOutlined, TagOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';
const { Option } = Select;
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
                        <Popconfirm title={<>Are you sure about deleting role <i>{role.name}</i>?</>} onConfirm={() => removeRole({ variables: { roleId: role.id } })} okText='Yes' cancelText='No'>
                            <Button icon={<DeleteOutlined />} danger ></Button>
                        </Popconfirm>
                    </div>
                }
            </div>
            <br />
            <PermissionsControlPanel
                roleId={role.id}
                originallySelectedPermissions={role.permissions}
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
            <Form onFinish={(variables) => addNewRole({
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
    roleId: string;
    originallySelectedPermissions: any;
}

const PermissionsControlPanel: FunctionComponent<PermissionsControlPanelProps> = ({
    roleId,
    originallySelectedPermissions
}) => {
    return (
        <Mutation<any, any>
            mutation={EDIT_ROLE}
        // onCompleted={() => setSavedSuccessfully(true)}
        >
            {(submit, { loading, error }) =>
                <Form title='EditUserForm' initialValues={{
                    ...originallySelectedPermissions.data,
                    ...originallySelectedPermissions.manage
                }} layout='vertical' onFinish={(variables) => submit({
                    variables: {
                        roleId: roleId,
                        permissionChanges: {
                            data: {
                                subjectIds: variables.subjectIds,
                                visitIds: variables.visitIds,
                                fieldIds: variables.fieldIds,
                                hasVersioned: variables.hasVersioned,
                                operations: variables.operations
                            },
                            manage: {
                                own: variables.own,
                                role: variables.role
                            }
                        }
                    }
                })}>
                    <div>
                        <Form.Item name='subjectIds' label='Subject Id'>
                            <Select
                                mode='tags'
                                tokenSeparators={[',']}
                            />
                        </Form.Item>
                        <Form.Item name='visitIds' label='Visit Id'>
                            <Select
                                mode='tags'
                                tokenSeparators={[',']}
                            />
                        </Form.Item>
                        <Form.Item name='fieldIds' label='Field Id'>
                            <Select
                                mode='tags'
                                tokenSeparators={[',']}
                            />
                        </Form.Item>
                        <Form.Item name='operations' label='Operations'>
                            <Checkbox.Group
                                options={Object.keys(atomicOperation).map(el => {
                                    return { label: el, value: atomicOperation[el] };
                                })}
                            />
                        </Form.Item>
                        <Form.Item name='hasVersioned' label='Include Versioned Data' valuePropName="checked">
                            <Checkbox />
                        </Form.Item>
                    </div>
                    <div>
                        <Form.Item name='own' label='Self Management'>
                            <Checkbox.Group
                                options={Object.keys(atomicOperation).map(el => {
                                    return { label: el, value: atomicOperation[el] };
                                })}
                            />
                        </Form.Item>
                    </div>
                    <div>
                        <Form.Item name='role' label='Role Management'>
                            <Checkbox.Group
                                options={Object.keys(atomicOperation).map(el => {
                                    return { label: el, value: atomicOperation[el] };
                                })}
                            />
                        </Form.Item>
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

    const handleSelect = (value: string) => {
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

    const handleDeselect = (value: string) => {
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
