import * as React from 'react';
import { Mutation, useQuery, useMutation } from 'react-apollo';
import { NavLink } from 'react-router-dom';
import { IUserWithoutToken, userTypes } from 'itmat-commons/dist/models/user';
import { Subsection } from '../reusable';
import { LoadingBalls } from '../reusable/icons/loadingBalls';
import { ProjectSection } from './projectSection';
import css from './userList.module.css';
import { GQLRequests } from 'itmat-commons';
const {
    WHO_AM_I,
    DELETE_USER,
    EDIT_USER,
    GET_USERS,
    REQUEST_USERNAME_OR_RESET_PASSWORD
} = GQLRequests;

export const UserDetailsSection: React.FunctionComponent<{ userId: string }> = ({ userId }) => {
    const { loading, error, data } = useQuery(GET_USERS, { variables: {
        fetchDetailsAdminOnly: true, fetchAccessPrivileges: true, userId
    } });
    if (loading) { return <LoadingBalls />; }
    if (error) { return <p>Error :( {error.message}</p>; }
    const user: IUserWithoutToken = data.getUsers[0];
    if (user === null || user === undefined) { return <p>Oops! Cannot find user.</p>; }
    return (
        <>
            <div className="page_ariane">{data.getUsers[0].username}</div>
            <div className="page_content">
                <Subsection title="Account Information">
                    <EditUserForm user={user} />
                </Subsection>
                <Subsection title="Projects">
                    <ProjectSection projects={data.getUsers[0].access.projects} />
                </Subsection>
                <Subsection title="Datasets">
                    <ProjectSection study={true} projects={data.getUsers[0].access.studies} />
                </Subsection>
            </div>
        </>
    );
};

export const EditUserForm: React.FunctionComponent<{ user: (IUserWithoutToken & { access?: object }) }> = ({ user }) => {
    const [inputs, setInputs] = React.useState({ ...user, password: '' });
    const [deleteButtonShown, setDeleteButtonShown] = React.useState(false);
    const [userIsDeleted, setUserIsDeleted] = React.useState(false);
    const [savedSuccessfully, setSavedSuccessfully] = React.useState(false);
    const { loading: whoamiloading, error: whoamierror, data: whoamidata } = useQuery(WHO_AM_I);
    const [requestResetPassword] = useMutation(REQUEST_USERNAME_OR_RESET_PASSWORD, { onCompleted: () => { setRequestResetPasswordSent(true); } });
    const [requestResetPasswordSent, setRequestResetPasswordSent] = React.useState(false);

    if (inputs.id !== user.id) {
        setUserIsDeleted(false);
        setDeleteButtonShown(false);
        setInputs({ ...user, password: '' });
        setRequestResetPasswordSent(false);
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

    if (userIsDeleted) { return <p> User {user.username} is deleted. </p>; }
    if (whoamiloading) { return <p>Loading..</p>; }
    if (whoamierror) { return <p>ERROR: please try again.</p>; }

    return (
        <Mutation<any, any>
            mutation={EDIT_USER}
            onCompleted={() => setSavedSuccessfully(true)}
        >
            {(submit, { loading, error, data }) =>
                <>
                    <label>Username: <input type='text' value={inputs.username} onChange={e => { setInputs({ ...inputs, username: e.target.value }) }} /> </label><br /><br />
                    <label>Type:
                    <select value={inputs.type} onChange={e => { setInputs({ ...inputs, type: e.target.value } as any); }}>
                            <option value="STANDARD">System user</option>
                            <option value="ADMIN">System admin</option>
                        </select></label><br /><br />
                    <label>Real name: <input type='text' value={inputs.realName} onChange={e => { setInputs({ ...inputs, realName: e.target.value }) }} /> </label><br /><br />
                    {
                        whoamidata.whoAmI.id === user.id
                            ?
                            <><label>Password:  <input type='password' value={inputs.password} onChange={e => { setInputs({ ...inputs, password: e.target.value }) }} /></label><br/><br/></>
                            :
                            null
                    }
                    <label>Email: <input type='text' value={inputs.email} onChange={e => { setInputs({ ...inputs, email: e.target.value }) }} /></label><br /><br />
                    <label>Email Notification:  <input type='checkbox' checked={inputs.emailNotificationsActivated} onChange={e => { setInputs({ ...inputs, emailNotificationsActivated: e.target.checked }) }} /></label><br /><br />
                    <label>Description:  <input type='text' value={inputs.description} onChange={e => { setInputs({ ...inputs, description: e.target.value }) }} /></label> <br /><br />
                    <label>Organisation: <input type='text' value={inputs.organisation} onChange={e => setInputs({ ...inputs, organisation: e.target.value })} /> </label><br /><br />
                    <label>Created by (readonly): <input type='text' readOnly value={inputs.createdBy} /> </label><br /><br />
                    <label>Created at (readOnly): <input type='text' readOnly value={(new Date(inputs.createdAt)).toLocaleString()} /></label><br /><br />
                    <label>Expired at: <input type='datetime-local' value={(new Date(inputs.expiredAt)).toISOString().substring(0, 16) } onChange={e => { setInputs({ ...inputs, expiredAt: (new Date(e.target.value)).getTime() }) }} /></label><br /><br />
                    <label>Locked:  <input type='checkbox' checked={inputs.locked} onChange={e => { setInputs({ ...inputs, locked: e.target.checked }) }} /></label><br /><br />
                    <div className={css.submit_cancel_button_wrapper}>
                        <NavLink to={'/users'}><button className='button_grey'>Cancel</button></NavLink>
                        {loading ? <button>Loading</button> : <button onClick={() => { submit({ variables: { ...formatSubmitObj() } }); }}>Save</button>}
                    </div>
                    {
                        error ? <div className='error_banner'>{JSON.stringify(error)}</div> : null
                    }
                    {
                        savedSuccessfully ? <div className="saved_banner">Saved!</div> : null
                    }
                    <br /><br />
                    {
                        whoamidata.whoAmI.id !== user.id && whoamidata.whoAmI.type === userTypes.ADMIN
                            ?
                            (
                                requestResetPasswordSent
                                    ?
                                    <button className={css.request_sent_button}>Request sent</button>
                                    :
                                    <button
                                        onClick={() => {
                                            requestResetPassword({ variables: {
                                                forgotUsername: false,
                                                forgotPassword: true,
                                                username: user.username
                                            } })}}
                                    >Request reset password for user</button>
                            )
                            :
                            null
                    }
                    <br />
                    <Mutation<any, any>
                        mutation={DELETE_USER}
                        refetchQueries={[{ query: GET_USERS, variables: { fetchDetailsAdminOnly: false, fetchAccessPrivileges: false } }]}
                    >

                        {(deleteUser, { loading, error, data: UserDeletedData }) => {
                            if (UserDeletedData && UserDeletedData.deleteUser && UserDeletedData.deleteUser.successful) { setUserIsDeleted(true); }
                            if (error) return <p>{error.message}</p>
                            return (
                                <>
                                    <label>Delete this user:</label> {loading ? <p style={{ cursor: 'pointer', textDecoration: 'underline' }}> click here </p> : <p onClick={() => { setDeleteButtonShown(true) }} style={{ cursor: 'pointer', textDecoration: 'underline' }}> click here </p>}<br />
                                    {deleteButtonShown ? <><label>Are you sure about deleting user <i>{user.username}</i>?</label><br /> <span onClick={() => { deleteUser({ variables: { userId: user.id } }) }} className={css.really_delete_button}>Delete user {user.username}</span> <span onClick={() => { setDeleteButtonShown(false) }} style={{ cursor: 'pointer' }}> Cancel </span></> : null}
                                </>
                            );
                        }}
                    </Mutation>
                </>
            }

        </Mutation>
    );
};

