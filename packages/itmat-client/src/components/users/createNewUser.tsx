import * as React from 'react';
import { Mutation } from 'react-apollo';
import { CREATE_USER, GET_USERS_LIST } from '../../graphql/appUsers';
import * as css from '../../css/userList.css';

// import { IUserWithoutToken } from 'itmat-utils/dist/models/user';

export const CreateNewUser: React.FunctionComponent = props => {
    const [inputs, setInputs] = React.useState({
        username: '',
        password: '',
        realName: '',
        emailNotificationsActivated: false,
        email: '',
        type: 'STANDARD'
    });

    return (
        <Mutation
            mutation={CREATE_USER}
            refetchQueries={[ {query: GET_USERS_LIST }]}
        >
        {(createUser, { loading, error }) =>
            <div className={css.userDetail}>
                <h4>Create New User</h4>
                <form>
                    <label>Username: </label><input type='text' value={inputs.username} onChange={e => { setInputs({...inputs, username: e.target.value }); }}/> <br/><br/>
                    <label>Password: </label><input type='password' value={inputs.password} onChange={e => { setInputs({...inputs, password: e.target.value }); }}/> <br/><br/>
                    <label>Real name: </label><input type='text' value={inputs.realName} onChange={e => { setInputs({...inputs, realName: e.target.value }); }}/> <br/><br/>
                    <label>Email notification: </label><input type='checkbox' checked={inputs.emailNotificationsActivated} onChange={e => { setInputs({...inputs, emailNotificationsActivated: e.target.checked }); }}/> <br/><br/>
                    <label>Email: </label><input type='text' value={inputs.email} onChange={e => { setInputs({...inputs, email: e.target.value }); }}/> <br/><br/>
                    <label>Type: </label><select value={inputs.type} onChange={e => { setInputs({...inputs, type: e.target.value }); }}>
                        <option value="STANDARD">System user</option>
                        <option value="ADMIN">System admin</option>
                    </select>
                    <br/><br/>
                { loading ? <button>Loading...</button> : <button onClick={e => {e.preventDefault(); createUser({variables: inputs})}}>Submit</button> }
                </form>
            </div>
        }
        </Mutation>
    );
};