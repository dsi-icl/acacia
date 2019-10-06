import { Models, permissions } from 'itmat-utils';
import { IRole } from 'itmat-utils/dist/models/study';
import * as React from 'react';
import { Mutation, Query } from 'react-apollo';
import { GET_USERS } from '../../graphql/appUsers';
import { ADD_NEW_ROLE, EDIT_ROLE, REMOVE_ROLE } from '../../graphql/permission';
import { GET_PROJECT } from '../../graphql/projects';
import { LoadingBalls } from '../reusable/loadingBalls';
import * as css from './roleControlSection.module.css';
import { UserListPicker } from './userListPicker';

export const RoleControlSection: React.FunctionComponent<{studyId: string, projectId: string, roles: Models.Study.IRole[] }> = ({ roles, studyId, projectId }) => {
    return <div>
        {
            roles.map((el, ind) => <OneRole key={el.id} role={el} availablePermissions={Object.values(permissions.specific_project)}/>)
        }
        <AddRole studyId={studyId} projectId={projectId}/>
    </div>;
};

export const OneRole: React.FunctionComponent<{ role: Models.Study.IRole, availablePermissions: string[] }> = ({ role, availablePermissions }) => {
    return <div className={css.one_role}>
        <div className={css.role_header}>
            <label className={css.role_name}>{role.name}</label>
            <Mutation
                mutation={REMOVE_ROLE}
                update={( store, { data: { removeRole } }) => {
                    const cachedata = store.readQuery({ query: GET_PROJECT, variables: { projectId: role.projectId, admin: true } }) as any;
                    if (!cachedata) { return; }
                    cachedata.getProject.roles = cachedata.getProject.roles.filter((el: IRole) => el.id !== role.id );
                    store.writeQuery({ query: GET_PROJECT, variables: { projectId: role.projectId, admin: true }, data: cachedata });
                }}
            >
            {(removeRole, { loading }) => {
                if (loading) { return <span className={css.right_aligned}><LoadingBalls/></span>; }
                return <span className={css.delete_role_button + ' ' + css.right_aligned} onClick={() => removeRole({ variables: { roleId: role.id }})}>X</span>;
            }}
            </Mutation>
        </div>
        <label>Permissions: </label><br/><br/>
        <PermissionsControlPanel roleId={role.id} availablePermissions={availablePermissions} originallySelectedPermissions={role.permissions}/>
        <br/>
        <label>Users of this role: </label>
        <br/> <br/>
        <Query query={GET_USERS} variables={{ fetchDetailsAdminOnly: false, fetchAccessPrivileges: false }}>
        {({ data, error, loading }) => {
            if (error) { return null; }
            if (loading) { return null; }
            return <Mutation
                mutation={EDIT_ROLE}
            >
            {(addUserToRole, { loading: loadingAddUser }) =>
                <Mutation mutation={EDIT_ROLE}>
                {(removeUserFromRole, { loading: loadingRemoveUser } ) =>
                    <UserListPicker.UserList
                        studyId={role.studyId}
                        projectId={role.projectId}
                        submitButtonString="Add user"
                        availableUserList={data.getUsers}
                        onClickAddButton={loadingAddUser ? () => {} : (studyId, projectId, user) => { addUserToRole({ variables: { roleId: role.id, userChanges: { add: [user.id], remove: [] } }}); }}
                    >
                    {role.users.map((el) => <UserListPicker.User key={(el as any).id} user={el as any} onClickCross={loadingRemoveUser ? () => {} : (user) => removeUserFromRole({ variables: { roleId: role.id, userChanges: { add: [], remove: [user.id] } }}) }/>)}
                    {/* {role.users.map(el => <UserListPicker.User user={el as any} onClickCross={loadingRemoveUser ? () => {} : (user) => removeUserFromRole() }/>)} */}
                    </UserListPicker.UserList>
                }
                </Mutation>
            }
            </Mutation>;
        }}
        </Query>
        <br/><br/>
    </div>;
};


export const AddRole: React.FunctionComponent<{ studyId: string, projectId: string }> = ({ studyId, projectId }) => {
    const [isExpanded, setIsExpanded] = React.useState(false);
    const [inputNameString, setInputNameString] = React.useState('');

    if (!isExpanded) { return <span className={css.add_new_role_button} onClick={() => setIsExpanded(true)}>Add new role</span>; }
    return <div className={css.add_new_role_section}>
        <span>Create new role</span><br/><br/>
        <label>Name: </label><input placeholder="Role name" value={inputNameString} onChange={(e) => setInputNameString(e.target.value)}/> <br/>
        <div className={css.add_new_role_buttons_wrapper}>
            <button className="button_grey" onClick={() => setIsExpanded(false)}>Cancel</button>
            <Mutation
                mutation={ADD_NEW_ROLE}
                update={( store, { data: { addRoleToStudyOrProject } }) => {
                    const cachedata = store.readQuery({ query: GET_PROJECT, variables: { projectId, admin: true } }) as any;
                    console.log(cachedata);
                    if (!cachedata) { return; }
                    cachedata.getProject.roles.push(addRoleToStudyOrProject);
                    store.writeQuery({ query: GET_PROJECT, variables: { projectId, admin: true }, data: cachedata });
                }}
            >
            {(addNewRole, { loading, error }) =>
                <button onClick={() => { setInputNameString(''); setIsExpanded(false); addNewRole({ variables: { studyId, projectId, roleName: inputNameString } }); }}>Submit</button>
            }
            </Mutation>
        </div>
    </div>;
};


const PermissionsControlPanel: React.FunctionComponent<{ roleId: string, availablePermissions: string[], originallySelectedPermissions: string[] }> = ({ roleId, availablePermissions, originallySelectedPermissions}) => {
    return <div className={css.permissions_section}>
        {availablePermissions.map((el) =>
            originallySelectedPermissions.includes(el) ?
            <React.Fragment key={el}>
            <Mutation mutation={EDIT_ROLE}>
            {(editRole, { loading }) => {
                if (loading) { return <div key={el} className={css.permission_selected + ' button_loading'}>{el}</div>; }

                return <div onClick={() => {
                    editRole({ variables: {
                        roleId,
                        permissionChanges: {
                            add: [],
                            remove: [el]
                        }
                    }});
                }} key={el} className={css.permission_selected}>{el}</div>;
            }}
            </Mutation>
            </React.Fragment>
            :
            <React.Fragment key={el}>
            <Mutation mutation={EDIT_ROLE}>
            {(editRole, { loading }) => {
                if (loading) { return <div key={el} className="button_loading">{el}</div>; }

                return <div onClick={() => {
                    editRole({ variables: {
                        roleId,
                        permissionChanges: {
                            add: [el],
                            remove: []
                        }
                    }});
                }} key={el}>{el}</div>;
            }}
            </Mutation>
            </React.Fragment>
        )}
    </div>;
};
