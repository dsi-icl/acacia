import * as React from 'react';
import { Query } from 'react-apollo';
import { GET_SPECIFIC_USER } from '../../graphql/appUsers';
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
    const { username, type, realName, email, emailNotificationsActivated, createdBy, description } = user;
    const [inputs, setInputs] = React.useState({
        username,
        description,
        password: '',
        type,
        realName,
        email,
        emailNotificationsActivated,
        createdBy,
    });

    function clickedSave(e: any) {
        e.preventDefault();
        const editUserObj = { ...inputs };
        if (inputs.password === '') {
            delete editUserObj.password;
        }
        console.log(editUserObj);

    }

    return (
        <div className={css.userDetail}>
            <h4>{user.username}</h4>
            <label>Type: </label>
                <select value={inputs.type} onChange={e => { setInputs({...inputs, type: e.target.value } as any); }}>
                    <option value="STANDARD">System user</option>
                    <option value="ADMIN">System admin</option>
                </select><br/>
            <label>Real name: </label> <input type='text' value={inputs.realName} onChange={e => { setInputs({...inputs, realName: e.target.value }) }}/> <br/>
            <label>Password: </label> <input type='password' value={inputs.password} onChange={e => { setInputs({...inputs, password: e.target.value }) }}/> <br/>
            <label>Email: </label> <input type='text' value={inputs.email} onChange={e => { setInputs({...inputs, email: e.target.value }) }}/><br/>
            <label>Email Notification: </label> <input type='checkbox' checked={inputs.emailNotificationsActivated} onChange={e => { setInputs({...inputs, emailNotificationsActivated: e.target.checked }) }}/><br/>
            <label>Description: </label> <input type='text' value={inputs.description} onChange={e => { setInputs({...inputs, description: e.target.value }) }}/> <br/>
            <label>Created by: </label> {inputs.createdBy} <br/>
            <button onClick={clickedSave}>Save</button>
        </div>
    );
};

