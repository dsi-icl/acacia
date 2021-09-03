import * as React from 'react';
import { Mutation } from '@apollo/client/react/components';
import { useQuery, useMutation } from '@apollo/client/react/hooks';
import {
    Models,
    permissions,
    ADD_NEW_ROLE,
    EDIT_ROLE,
    REMOVE_ROLE,
    GET_USERS,
    GET_PROJECT,
    GET_STUDY,
    flattenObjectToArray
} from 'itmat-commons';
import { LoadingBalls } from '../icons/loadingBalls';
import css from './roleControlSection.module.css';
import { UserListPicker } from '../userSelectionList/userListPicker';

export const RoleControlSection: React.FunctionComponent<{ studyId: string; projectId?: string; roles: Models.Study.IRole[] }> = ({ roles, studyId, projectId }) => {
    return <div>
        {
            roles.map((el) => <OneRole key={el.id} role={el} availablePermissions={projectId ? flattenObjectToArray(permissions.project_specific) : flattenObjectToArray(permissions.dataset_specific)} />)
        }
        <AddRole studyId={studyId} projectId={projectId} />
    </div>;
};

export const OneRole: React.FunctionComponent<{ role: Models.Study.IRole; availablePermissions: string[] }> = ({ role, availablePermissions }) => {
    const isStudyRole = role.projectId ? false : true;
    const { data: userData, loading: userFetchLoading } = useQuery(GET_USERS, { variables: { fetchDetailsAdminOnly: false, fetchAccessPrivileges: false } });
    const [removeRole, { loading: removeRoleLoading }] = useMutation(REMOVE_ROLE, { refetchQueries: [{ query: isStudyRole ? GET_STUDY : GET_PROJECT, variables: isStudyRole ? { studyId: role.studyId } : { projectId: role.projectId, admin: true } }] });
    const [addUserToRole, { loading: loadingAddUser }] = useMutation(EDIT_ROLE);
    const [removeUserFromRole, { loading: loadingRemoveUser }] = useMutation(EDIT_ROLE);

    if (userFetchLoading) { return <LoadingBalls />; }
    return <div className={css.one_role}>
        {removeRoleLoading ? <span className={css.right_aligned}><LoadingBalls /></span> : <span className={css.delete_role_button + ' ' + css.right_aligned} onClick={() => removeRole({ variables: { roleId: role.id } })}>X</span>}
        <div className={css.role_header}>
            <label className={css.role_name}>{role.name}</label>
        </div>
        <label>Permissions: </label><br /><br />
        <PermissionsControlPanel roleId={role.id} availablePermissions={availablePermissions} originallySelectedPermissions={role.permissions} />
        <br />
        <label>Users of this role: </label>
        <br /> <br />
        <UserListPicker.UserList
            studyId={role.studyId}
            projectId={role.projectId}
            submitButtonString='Add user'
            availableUserList={userData.getUsers}
            onClickAddButton={loadingAddUser ? () => { return; } : (__unused__studyId, __unused__projectId, user) => { addUserToRole({ variables: { roleId: role.id, userChanges: { add: [user.id], remove: [] } } }); }}
        >
            {role.users.map((el) => <UserListPicker.User key={(el as any).id} user={el as any} onClickCross={loadingRemoveUser ? () => { return; } : (user) => removeUserFromRole({ variables: { roleId: role.id, userChanges: { add: [], remove: [user.id] } } })} />) as any}
        </UserListPicker.UserList>
        <br /><br />
    </div>;
};

export const AddRole: React.FunctionComponent<{ studyId: string; projectId?: string }> = ({ studyId, projectId }) => {
    const [isExpanded, setIsExpanded] = React.useState(false);
    const [inputNameString, setInputNameString] = React.useState('');

    const refetchQueries = projectId ? [{ query: GET_PROJECT, variables: { projectId, admin: true } }] : [{ query: GET_STUDY, variables: { studyId, admin: true } }];

    if (!isExpanded) { return <span className={css.add_new_role_button} onClick={() => setIsExpanded(true)}>Add new role</span>; }
    return <div className={css.add_new_role_section}>
        <span>Create new role</span><br /><br />
        <label>Name: </label><input placeholder='Role name' value={inputNameString} onChange={(e) => setInputNameString(e.target.value)} /> <br />
        <div className={css.add_new_role_buttons_wrapper}>
            <button className='button_grey' onClick={() => setIsExpanded(false)}>Cancel</button>
            <Mutation<any, any>
                mutation={ADD_NEW_ROLE}
                refetchQueries={refetchQueries}
            >
                {(addNewRole) =>
                    <button onClick={() => { setInputNameString(''); setIsExpanded(false); addNewRole({ variables: { studyId, projectId, roleName: inputNameString } }); }}>Submit</button>
                }
            </Mutation>
        </div>
    </div>;
};

const PermissionsControlPanel: React.FunctionComponent<{ roleId: string; availablePermissions: string[]; originallySelectedPermissions: string[] }> = ({ roleId, availablePermissions, originallySelectedPermissions }) => {
    return <div className={css.permissions_section}>
        {availablePermissions.map((el) =>
            originallySelectedPermissions.includes(el) ?
                <React.Fragment key={el}>
                    <Mutation<any, any> mutation={EDIT_ROLE}>
                        {(editRole, { loading }) => {
                            if (loading) { return <div key={el} className={css.permission_selected + ' button_loading'}>{el}</div>; }

                            return <div onClick={() => {
                                editRole({
                                    variables: {
                                        roleId,
                                        permissionChanges: {
                                            add: [],
                                            remove: [el]
                                        }
                                    }
                                });
                            }} key={el} className={css.permission_selected}>{el}</div>;
                        }}
                    </Mutation>
                </React.Fragment>
                :
                <React.Fragment key={el}>
                    <Mutation<any, any> mutation={EDIT_ROLE}>
                        {(editRole, { loading }) => {
                            if (loading) { return <div key={el} className='button_loading'>{el}</div>; }

                            return <div onClick={() => {
                                editRole({
                                    variables: {
                                        roleId,
                                        permissionChanges: {
                                            add: [el],
                                            remove: []
                                        }
                                    }
                                });
                            }} key={el}>{el}</div>;
                        }}
                    </Mutation>
                </React.Fragment>
        )}
    </div>;
};
