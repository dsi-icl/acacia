import { Models, permissions } from 'itmat-commons';
import * as React from 'react';
import { Mutation, useQuery, useMutation } from 'react-apollo';
import { GET_USERS } from 'itmat-commons/dist/graphql/appUsers';
import { ADD_NEW_ROLE, EDIT_ROLE, REMOVE_ROLE } from 'itmat-commons/src/graphql/permission';
import { GET_PROJECT } from 'itmat-commons/dist/graphql/projects';
import { GET_STUDY } from 'itmat-commons/dist/graphql/study';
import { LoadingBalls } from '../icons/loadingBalls';
import css from './roleControlSection.module.css';
import { Tag, Select, Button } from 'antd';
import { LoadingOutlined, TagOutlined } from '@ant-design/icons';

type RoleControlSectionProps = {
    studyId: string;
    projectId?: string;
    roles: Models.Study.IRole[];
}

export const RoleControlSection: React.FC<RoleControlSectionProps> = ({
    roles,
    studyId,
    projectId
}) => {
    return (
        <>
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
            <AddRole studyId={studyId} projectId={projectId} />
        </>
    )
};

export default RoleControlSection;

type RoleDescriptorProps = {
    role: Models.Study.IRole;
    availablePermissions: string[];
}

export const RoleDescriptor: React.FC<RoleDescriptorProps> = ({
    role,
    availablePermissions
}) => {
    const isStudyRole = !role.projectId;
    const { data: userData, loading: userFetchLoading } = useQuery(GET_USERS, { variables: { fetchDetailsAdminOnly: false, fetchAccessPrivileges: false } });
    const [removeRole, { loading: removeRoleLoading }] = useMutation(REMOVE_ROLE, { refetchQueries: [{ query: isStudyRole ? GET_STUDY : GET_PROJECT, variables: isStudyRole ? { studyId: role.studyId } : { projectId: role.projectId, admin: true } }] });

    if (userFetchLoading) { return <LoadingBalls />; }
    return (
        <div className={css.one_role}>
            <div className={css.role_header}>
                <label className={css.role_name}>{role.name}</label>
                {removeRoleLoading ? <span className={css.right_aligned}><LoadingBalls /></span> : <span className={`${css.delete_role_button} ${css.right_aligned}`} onClick={() => removeRole({ variables: { roleId: role.id } })}>X</span>}
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
            <label>Users of this role: </label>
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

export const AddRole: React.FC<AddRoleProps> = ({
    studyId,
    projectId
}) => {

    const [isExpanded, setIsExpanded] = React.useState(false);
    const [inputNameString, setInputNameString] = React.useState('');
    const refetchQueries = projectId ? [{
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
    }];

    if (!isExpanded)
        return <span
            className={css.add_new_role_button}
            onClick={() => setIsExpanded(true)}>
            Add new role
        </span>;

    return (
        <div className={css.add_new_role_section}>
            <span>Create new role</span>
            <br />
            <br />
            <label>Name: </label>
            <input
                placeholder="Role name"
                value={inputNameString}
                onChange={(e) => setInputNameString(e.target.value)}
            />
            <br />
            <div className={css.add_new_role_buttons_wrapper}>
                <Button onClick={() => setIsExpanded(false)}>
                    Cancel
                </Button>
                <Mutation<any, any>
                    mutation={ADD_NEW_ROLE}
                    refetchQueries={refetchQueries}
                >
                    {(addNewRole) => <button onClick={() => {
                        setInputNameString('');
                        setIsExpanded(false);
                        addNewRole({
                            variables: {
                                studyId,
                                projectId,
                                roleName:
                                    inputNameString
                            }
                        });
                    }}>Submit</button>}
                </Mutation>
            </div>
        </div>
    );
};

type PermissionsControlPanelProps = {
    roleId: string;
    availablePermissions: string[];
    originallySelectedPermissions: string[]
}

const PermissionsControlPanel: React.FC<PermissionsControlPanelProps> = ({
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

                    <Mutation<any, any> mutation={EDIT_ROLE}>
                        {(editRole, { loading }) => (
                            <Button
                                size="small"
                                type={isSelected ? "primary" : "default"}
                                key={index}
                                icon={loading ? <LoadingOutlined /> : <TagOutlined />}
                                style={{
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
                                {permission}
                            </Button>
                        )}
                    </Mutation>
                )
            })}
        </>
    );
};

type UsersControlPanelProps = {
    roleId: string;
    studyId: string;
    projectId?: string;
    availableUserList: Models.UserModels.IUser[];
    originallySelectedUsers: Models.UserModels.IUser[]
}

const UsersControlPanel: React.FC<UsersControlPanelProps> = ({
    roleId,
    studyId,
    projectId,
    availableUserList,
    originallySelectedUsers
}) => {
    const [editUsers, { loading }] = useMutation(EDIT_ROLE);

    const handleSelect = (value: string) => {
        return editUsers({
            variables: {
                roleId,
                userChanges: {
                    add: [value],
                    remove: []
                }
            }
        })
    }

    const handleDeselect = (value: string) => {
        return editUsers({
            variables: {
                roleId,
                userChanges: {
                    add: [],
                    remove: [value]
                }
            }
        })
    }

    const tagRender = (props: any) => {

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
                    })
                }}
            >
                {label}
            </Tag>
        )
    }

    return (
        <Select
            mode="multiple"
            loading={loading}
            style={{ width: '100%' }}
            placeholder="Add users to this role"
            tokenSeparators={[',', ';']}
            defaultValue={originallySelectedUsers.map(user => user.id)}
            onSelect={handleSelect}
            onDeselect={handleDeselect}
            tagRender={tagRender}
        >
            {
                availableUserList.map((user, index) => (
                    <Select.Option key={index} value={user.id}>
                        {user.realName} ({user.organisation})
                    </Select.Option>
                ))
            }
        </Select >
    );
};
