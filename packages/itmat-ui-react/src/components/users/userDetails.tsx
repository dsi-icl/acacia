import * as React from 'react';
import { Query, Mutation } from 'react-apollo';
import { EDIT_USER, GET_USERS, DELETE_USER } from '../../graphql/appUsers';
import * as css from './userList.module.css';
import { IUserWithoutToken } from 'itmat-utils/dist/models/user';
import { NavLink } from 'react-router-dom';
import { Subsection } from '../reusable';
import { ProjectSection } from './projectSection';
import { LoadingBalls } from '../reusable/loadingBalls';

export const UserDetailsSection: React.FunctionComponent<{ userId: string }> = ({ userId }) => {
    return (
        <Query query={GET_USERS} variables={{ fetchDetailsAdminOnly: true, fetchAccessPrivileges: true, userId }}>
            {({loading, error, data }) => {
                if (loading) return <LoadingBalls/>;
                if (error) return <p>Error :( {error.message}</p>;
                const user: IUserWithoutToken = data.getUsers[0];
                if (user === null || user === undefined) { return <p>Oops! Cannot find user.</p>; };
                return (
                    <>
                        <div className='page_ariane'>{data.getUsers[0].username}</div>
                        <div className='page_content'>
                            <Subsection title='Account Information'>
                                <EditUserForm user={user}/>
                            </Subsection>
                            <Subsection title='Projects'>
                                <ProjectSection projects={data.getUsers[0].access.projects}/>
                            </Subsection> 
                            <Subsection title='Datasets'>
                                <ProjectSection study={true} projects={data.getUsers[0].access.studies}/>
                            </Subsection> 
                        </div>
                    </>
                );
            }}
        </Query>
    );
};

export const EditUserForm: React.FunctionComponent<{ user: (IUserWithoutToken & { access?: object }) }> = ({user}) => {
    const [inputs, setInputs] = React.useState({ ...user, password: '' });
    const [deleteButtonShown, setDeleteButtonShown]  = React.useState(false);
    const [userIsDeleted, setUserIsDeleted] = React.useState(false);
    const [savedSuccessfully, setSavedSuccessfully] = React.useState(false);
    console.log(inputs);
    if (inputs.id !== user.id) {
        setUserIsDeleted(false);
        setDeleteButtonShown(false);
        setInputs({ ...user, password: '' })
    }

    function formatSubmitObj() {
        const editUserObj = { ...inputs };
        if (inputs.password === '') {
            delete editUserObj.password;
        }
        if (inputs.access !== undefined) {
            delete editUserObj.access;
        }
        return editUserObj;
    }

    if (userIsDeleted) { return <p> User {user.username} is deleted. </p>}

    return (
        <Mutation
            mutation={EDIT_USER}
            onCompleted={() => setSavedSuccessfully(true)}
        >
        {(submit, { loading, error, data }) =>
            <>
                <label>Username: </label> <input type='text' value={inputs.username} onChange={e => { setInputs({...inputs, username: e.target.value }) }}/> <br/><br/>
                <label>Type: </label>
                    <select value={inputs.type} onChange={e => { setInputs({...inputs, type: e.target.value } as any); }}>
                        <option value="STANDARD">System user</option>
                        <option value="ADMIN">System admin</option>
                    </select><br/><br/>
                <label>Real name: </label> <input type='text' value={inputs.realName} onChange={e => { setInputs({...inputs, realName: e.target.value }) }}/> <br/><br/>
                <label>Password: </label> <input type='password' value={inputs.password} onChange={e => { setInputs({...inputs, password: e.target.value }) }}/> <br/><br/>
                <label>Email: </label> <input type='text' value={inputs.email} onChange={e => { setInputs({...inputs, email: e.target.value }) }}/><br/><br/>
                <label>Email Notification: </label> <input type='checkbox' checked={inputs.emailNotificationsActivated} onChange={e => { setInputs({...inputs, emailNotificationsActivated: e.target.checked }) }}/><br/><br/>
                <label>Description: </label> <input type='text' value={inputs.description} onChange={e => { setInputs({...inputs, description: e.target.value }) }}/> <br/><br/>
                <label>Organisation: </label> <input type='text' value={inputs.organisation} onChange={e => setInputs({...inputs, organisation: e.target.value })} /> <br/><br/>
                <label>Created by (readonly): </label ><input type='text' readOnly value={inputs.createdBy}/> <br/><br/>
                <div className={css.submit_cancel_button_wrapper}>
                    <NavLink to={'/users'}><button className='button_grey'>Cancel</button></NavLink>
                    {loading ? <button>Loading</button> : <button onClick={() => { submit({ variables: { ...formatSubmitObj() } }); }}>Save</button> }
                </div>
                {
                    error ? <div className='error_banner'>{JSON.stringify(error)}</div> : null
                }

                {
                    savedSuccessfully ? <div className='saved_banner'>Saved!</div> : null
                }

                <br/><br/><br/>
                <Mutation
                    mutation={DELETE_USER}
                    refetchQueries={[{ query: GET_USERS, variables: { fetchDetailsAdminOnly: false, fetchAccessPrivileges: false } }]}
                >
                
                {(deleteUser, { loading, error, data: UserDeletedData }) => {
                    if (UserDeletedData && UserDeletedData.deleteUser && UserDeletedData.deleteUser.successful) { setUserIsDeleted(true); }
                    if (error) return <p>{error.message}</p>
                    return (
                        <>
                            <label>Delete this user: </label> { loading ? <p style={{cursor: 'pointer', textDecoration: 'underline'}}> click here </p> : <p onClick={()=>{ setDeleteButtonShown(true)}} style={{cursor: 'pointer', textDecoration: 'underline'}}> click here </p> }<br/>
                            { deleteButtonShown ? <><label>Are you sure about deleting user <i>{user.username}</i>?</label><br/> <span onClick={() => { deleteUser({ variables: { userId: user.id }})} } className={css.really_delete_button}>Delete user {user.username}</span> <span onClick={()=>{ setDeleteButtonShown(false)}} style={{ cursor: 'pointer'}}> Cancel </span></> : null }
                        </>
                    );
                }}
                </Mutation>
            </>
        }
        </Mutation>
    );
};

