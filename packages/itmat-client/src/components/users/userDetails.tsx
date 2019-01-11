import * as React from 'react';
import { Query, Mutation } from 'react-apollo';
import { GET_SPECIFIC_USER, EDIT_USER, GET_USERS_LIST, DELETE_USER } from '../../graphql/appUsers';
import * as css from '../../css/userList.css';
import { IUserWithoutToken } from 'itmat-utils/dist/models/user';

export const UserDetailsSection: React.FunctionComponent<{ username: string }> = ({ username }) => {
    return (
        <Query query={GET_SPECIFIC_USER} variables={{ username }}>
            {({loading, error, data }) => {
                if (loading) return <p>Loading...</p>;
                if (error) return <p>Error :( {error.message}</p>;
                const user: IUserWithoutToken = data.getUsers[0];
                if (user === null || user === undefined) { return `Oops! Cannot find user with username "${username}".` };
                return (
                    <EditUserForm user={user}/>
                );
            }}
        </Query>
    );
};

export const EditUserForm: React.FunctionComponent<{ user: IUserWithoutToken }> = ({user}) => {
    const [inputs, setInputs] = React.useState({ ...user, password: '' });
    const [deleteButtonShown, setDeleteButtonShown]  = React.useState(false);
    const [userIsDeleted, setUserIsDeleted] = React.useState(false);

    if (inputs.username !== user.username) {
        setInputs({ ...user, password: '' })
    }

    function formatSubmitObj() {
        const editUserObj = { ...inputs };
        if (inputs.password === '') {
            delete editUserObj.password;
        }
        console.log(editUserObj);
        delete editUserObj.description;
        return editUserObj;
    }

    if (userIsDeleted) { return <p> User {user.username} is deleted. </p>}

    return (
        <Mutation
            mutation={EDIT_USER}
            refetchQueries={[ { query: GET_USERS_LIST } ]}
        >
        {(submit, { loading, error, data }) =>
            <div className={css.userDetail}>
                <h4>{user.username}</h4>
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
                <label>Created by (readonly): </label ><input type='text' readOnly value={inputs.createdBy}/> <br/><br/>
                {loading ? <button>Loading</button> : <button onClick={() => { submit({ variables: { ...formatSubmitObj() } }); }}>Save</button> }

                <br/><br/><br/>
                <Mutation
                    mutation={DELETE_USER}
                    refetchQueries={[ { query: GET_USERS_LIST } ]}
                >
                {(deleteUser, { loading, error, data: UserDeletedData }) => {
                    if (UserDeletedData && UserDeletedData.deleteUser && UserDeletedData.deleteUser.successful) { setUserIsDeleted(true); }
                    return (
                        <>
                            <label>Delete this user: </label> <p onClick={()=>{ setDeleteButtonShown(true)}} style={{cursor: 'pointer', textDecoration: 'underline'}}> click here </p> <br/>
                            { deleteButtonShown ? <><label>Are you sure?</label><br/> <span onClick={() => { deleteUser({ variables: { username: user.username }})} } style={{ backgroundColor: 'red'}}> Delete this user </span> <span onClick={()=>{ setDeleteButtonShown(false)}}> Cancel </span></> : null }
                        </>
                    );
                }}
                </Mutation>
            </div>
        }
        </Mutation>
    );
};

