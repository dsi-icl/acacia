import * as React from 'react';
import { Mutation } from '@apollo/client/react/components';
import { useQuery, useMutation } from '@apollo/client/react/hooks';
import {
    Models,
    permissions,
    permissionLabels,
    ADD_NEW_ROLE,
    EDIT_ROLE,
    REMOVE_ROLE,
    GET_USERS,
    GET_PROJECT,
    GET_STUDY,
    GET_ORGANISATIONS
} from 'itmat-commons';
import LoadSpinner from '../loadSpinner';
import css from './roleControlSection.module.css';
import { Tag, Select, Button, Form, Input, Alert, Popconfirm } from 'antd';
import { LoadingOutlined, TagOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';

type RoleControlSectionProps = {
    studyId: string;
    projectId?: string;
    roles: Models.Study.IRole[];
}

export const RoleControlSection: React.FunctionComponent<RoleControlSectionProps> = ({
    roles,
    studyId,
    projectId
}) => {
    return (
        <>
            <AddRole studyId={studyId} projectId={projectId} />
            <br />
            {roles.map((el) =>
                <RoleDescriptor
                    key={el.id}
                    role={el}
                    availablePermissions={
                        projectId
                            ? Object.values(permissions.specific_project)
                            : Object.values(permissions.specific_study)
                    } />
            )}
        </>
    );
};

export default RoleControlSection;

type RoleDescriptorProps = {
    role: Models.Study.IRole;
    availablePermissions: string[];
}

export const RoleDescriptor: React.FunctionComponent<RoleDescriptorProps> = ({
    role,
    availablePermissions
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
            <label>Permissions: </label>
            <br />
            <PermissionsControlPanel
                roleId={role.id}
                availablePermissions={availablePermissions}
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
            />
        </div>
    );
};

type AddRoleProps = {
    studyId: string;
    projectId?: string;
}

export const AddRole: React.FunctionComponent<AddRoleProps> = ({
    studyId,
    projectId
}) => {

    const [isExpanded, setIsExpanded] = React.useState(false);
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
    availablePermissions: string[];
    originallySelectedPermissions: string[];
}

const PermissionsControlPanel: React.FunctionComponent<PermissionsControlPanelProps> = ({
    roleId,
    availablePermissions,
    originallySelectedPermissions
}) => {

    return (
        <>
            {availablePermissions.map((permission, index) => {

                let isSelected = false;
                if (originallySelectedPermissions.includes(permission))
                    isSelected = true;

                return (

                    <Mutation<any, any> mutation={EDIT_ROLE} key={index}>
                        {(editRole, { loading }) => (
                            <Button
                                size='small'
                                type={isSelected ? 'primary' : 'default'}
                                icon={loading ? <LoadingOutlined /> : <TagOutlined />}
                                style={{
                                    fontSize: '12px',
                                    cursor: 'pointer',
                                    marginRight: 3,
                                    marginBottom: 3,
                                }}
                                onClick={() => editRole({
                                    variables: {
                                        roleId,
                                        permissionChanges: {
                                            add: isSelected ? [] : [permission],
                                            remove: isSelected ? [permission] : [],
                                        },
                                    },
                                })}
                            >
                                {permissionLabels[permission]}
                            </Button>
                        )}
                    </Mutation>
                );
            })}
        </>
    );
};

type UsersControlPanelProps = {
    roleId: string;
    studyId: string;
    projectId?: string;
    availableUserList: Models.UserModels.IUser[];
    originallySelectedUsers: Models.UserModels.IUser[];
}

const UsersControlPanel: React.FunctionComponent<UsersControlPanelProps> = ({
    roleId,
    availableUserList,
    originallySelectedUsers
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
                }
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
                }
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
                            }
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
            A error occured, please contact your administrator: {getOrgsError.message}
        </div>;

    const sites = getOrgsData.getOrganisations.filter(org => org.metadata?.siteIDMarker).reduce((prev, current) => ({
        ...prev,
        [current.metadata.siteIDMarker]: current.name
    }), {});

    return (
        <Select
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
