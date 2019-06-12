import { Models } from 'itmat-utils';
import * as React from 'react';
import { Query, Mutation } from 'react-apollo';
import { GET_PROJECT } from '../../../../graphql/projects';
import { CREATE_USER, GET_USERS } from '../../../../graphql/appUsers';
import * as css from './tabContent.module.css';
import { NavLink, Redirect } from 'react-router-dom';
import { Subsection, UserListPicker } from '../../../reusable';
import { EDIT_ROLE, ADD_NEW_ROLE, REMOVE_ROLE } from '../../../../graphql/permission';
import { IRole } from 'itmat-utils/dist/models/study';
import { LoadingBalls } from '../../../reusable/loadingBalls';

export const AdminTabContent: React.FunctionComponent<{studyId: string, projectId: string, roles: Models.Study.IRole[] }> = ({ roles, studyId, projectId }) => {
    return <div className={css.tab_page_wrapper_grid}>
        <div className={css.tab_page_wrapper + ' ' + css.main_page}>
            <Subsection title='Roles'>
                <div>
                    {
                        roles.map((el, ind) => <OneRole key={el.id} role={el}/>)
                    }
                    <AddRole studyId={studyId} projectId={projectId}/>
                </div>
            </Subsection>
            <Subsection title='Patient ID Mapping'>
                <div>
                    <button>Fetch mapping</button>
                </div>
            </Subsection>
        </div>
        <div className={css.tab_page_wrapper + ' ' + css.sub_page}>
            <Subsection title='User Access Log'>
                <div>

                </div>
            </Subsection>
        </div>
    </div>
};


export const OneRole: React.FunctionComponent<{ role: Models.Study.IRole }> = ({ role }) => {
    return <div className={css.one_role}>
        <div className={css.role_header}>
            <label className={css.role_name}>{role.name}</label>
            <Mutation
                mutation={REMOVE_ROLE}
                update={( store, { data: { removeRole } }) => {
                    const cachedata = store.readQuery({ query: GET_PROJECT, variables: { projectId: role.projectId, admin: true } }) as any;
                    if (!cachedata) return;
                    cachedata.getProject.roles = cachedata.getProject.roles.filter((el: IRole) => el.id !== role.id );
                    store.writeQuery({ query: GET_PROJECT, variables: { projectId: role.projectId, admin: true }, data: cachedata });
                }}
            >
            {(removeRole, { loading }) => {
                if (loading) return <span className={css.right_aligned}><LoadingBalls/></span>;
                return <span className={css.delete_role_button + ' ' + css.right_aligned} onClick={() => removeRole({ variables: { roleId: role.id }})}>X</span>;
            }}
            </Mutation>
        </div>
        <label>Permissions: </label>
        {role.permissions.map(el => <React.Fragment key={el}>{el}<br/><br/></React.Fragment>)}
        <label>Users of this role: </label>
        <br/> <br/>
        <Query query={GET_USERS} variables={{ fetchDetailsAdminOnly: false, fetchAccessPrivileges: false }}>
        {({ data, error, loading }) => {
            if (error) return null;
            if (loading) return null;
            return <Mutation
                mutation={EDIT_ROLE}
            >
            {(addUserToRole, { loading: loadingAddUser }) =>
                <Mutation mutation={EDIT_ROLE}>
                {(removeUserFromRole, { loading: loadingRemoveUser } ) =>
                    <UserListPicker.UserList
                        studyId={role.studyId}
                        projectId={role.projectId}
                        submitButtonString='Add user'
                        availableUserList={data.getUsers}
                        onClickAddButton={loadingAddUser ? () => {} : (studyId, projectId, user) => { addUserToRole({ variables: { roleId: role.id, userChanges: { add: [user.id], remove: [] } }}); }}
                    > 
                    {role.users.map(el => <UserListPicker.User key={(el as any).id} user={el as any} onClickCross={loadingRemoveUser ? () => {} : (user) => removeUserFromRole({ variables: { roleId: role.id, userChanges: { add: [], remove: [user.id] } }}) }/>)}
                    {/* {role.users.map(el => <UserListPicker.User user={el as any} onClickCross={loadingRemoveUser ? () => {} : (user) => removeUserFromRole() }/>)} */}
                    </UserListPicker.UserList>
                }
                </Mutation>
            }
            </Mutation>;
        }}
        </Query>
        <br/><br/>
    </div>
};


export const AddRole: React.FunctionComponent<{ studyId: string, projectId: string }> = ({ studyId, projectId }) => {
    const [isExpanded, setIsExpanded] = React.useState(false);
    const [inputNameString, setInputNameString] = React.useState('');

    if (!isExpanded) return <span className={css.add_new_role_button} onClick={() => setIsExpanded(true)}>Add new role</span>;
    return <div className={css.add_new_role_section}>
        <span>Create new role</span><br/><br/>
        <label>Name: </label><input placeholder='Role name' value={inputNameString} onChange={e => setInputNameString(e.target.value)}/> <br/>
        <label>Permissions: </label><input placeholder='Role name' value={inputNameString} onChange={e => setInputNameString(e.target.value)}/> <br/>
        <div className={css.add_new_role_buttons_wrapper}>
            <button className='button_grey' onClick={() => setIsExpanded(false)}>Cancel</button>
            <Mutation
                mutation={ADD_NEW_ROLE}
                update={( store, { data: { addRoleToStudyOrProject } }) => {
                    const cachedata = store.readQuery({ query: GET_PROJECT, variables: { projectId, admin: true } }) as any;
                    if (!cachedata) return;
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
}