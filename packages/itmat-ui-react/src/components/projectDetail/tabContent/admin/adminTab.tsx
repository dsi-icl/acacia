import { Models } from 'itmat-utils';
import * as React from 'react';
import { Query, Mutation } from 'react-apollo';
import { GET_PROJECT } from '../../../../graphql/projects';
import { CREATE_USER, GET_USERS } from '../../../../graphql/appUsers';
import * as css from './tabContent.module.css';
import { NavLink, Redirect } from 'react-router-dom';
import { Subsection, UserListPicker } from '../../../reusable';

export const AdminTabContent: React.FunctionComponent<{roles: Models.Study.IRole[]}> = ({ roles }) => {
    return <div className={css.tab_page_wrapper}>
        <Subsection title='Roles'>
            <div>
                {
                    roles.map((el, ind) => <OneRole key={el.id} role={el}/>)
                }
                <AddRole/>
            </div>
        </Subsection>
        <Subsection title='Patient ID Mapping'>
            <div>
                <button>Fetch mapping</button>
            </div>
        </Subsection>
    </div>;
};


export const OneRole: React.FunctionComponent<{ role: Models.Study.IRole }> = ({ role }) => {
    return <div className={css.one_role}>
        <label className={css.role_name}>{role.name}</label>
        <label>Permissions: </label>
        {role.permissions.map(el => <React.Fragment key={el}>{el}<br/><br/></React.Fragment>)}
        <label>Users of this role: </label>
        <br/> <br/>
        <Query query={GET_USERS} variables={{ fetchDetailsAdminOnly: false, fetchAccessPrivileges: false }}>
        {({ data, error, loading }) => {
            if (error) return null;
            if (loading) return null;
            return <Mutation
                mutation={CREATE_USER}
            >
            {(addUserToRole, { loading: loadingAddUser }) =>
                <Mutation mutation={CREATE_USER}>
                {(removeUserFromRole, { loading: loadingRemoveUser } ) =>
                    <UserListPicker.UserList
                        studyId={role.studyId}
                        projectId={role.projectId}
                        submitButtonString='Add user'
                        availableUserList={data.getUsers}
                        onClickAddButton={loadingAddUser ? () => {} : (studyId, projectId, user) => { addUserToRole(); }}
                    > 
                    {role.users.map(el => <UserListPicker.User user={el as any} onClickCross={loadingRemoveUser ? () => {} : (user) => removeUserFromRole() }/>)}
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


export const AddRole: React.FunctionComponent = props => {
    const [isExpanded, setIsExpanded] = React.useState(false);
    const [inputNameString, setInputNameString] = React.useState('');

    if (!isExpanded) return <span className={css.add_new_role_button} onClick={() => setIsExpanded(true)}>Add new role</span>;
    return <div className={css.add_new_role_section}>
        <span>Create new role</span><br/><br/>
        <label>Name: </label><input placeholder='Role name' value={inputNameString} onChange={e => setInputNameString(e.target.value)}/> <br/>
        <label>Permissions: </label><input placeholder='Role name' value={inputNameString} onChange={e => setInputNameString(e.target.value)}/> <br/>
        <div className={css.add_new_role_buttons_wrapper}>
            <button className='button_grey' onClick={() => setIsExpanded(false)}>Cancel</button>
            <button onClick={() => setIsExpanded(false)}>Submit</button>
        </div>
    </div>;
}