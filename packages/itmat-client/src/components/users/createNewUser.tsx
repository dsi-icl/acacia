import * as React from 'react';
import { Mutation } from 'react-apollo';
import { CREATE_USER, GET_USERS_LIST } from '../../graphql/appUsers';
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
            <>
                <form>
                    Username: <input type='text' value={inputs.username} onChange={e => { setInputs({...inputs, username: e.target.value }); }}/> <br/>
                    Password: <input type='text' value={inputs.password} onChange={e => { setInputs({...inputs, password: e.target.value }); }}/> <br/>
                    Real name: <input type='text' value={inputs.realName} onChange={e => { setInputs({...inputs, realName: e.target.value }); }}/> <br/>
                    Email notification: <input type='checkbox' checked={inputs.emailNotificationsActivated} onChange={e => { setInputs({...inputs, emailNotificationsActivated: e.target.checked }); }}/> <br/>
                    Email: <input type='text' value={inputs.email} onChange={e => { setInputs({...inputs, email: e.target.value }); }}/> <br/>
                    Type: <select value={inputs.type} onChange={e => { setInputs({...inputs, type: e.target.value }); }}>
                        <option value="STANDARD">System user</option>
                        <option value="ADMIN">System admin</option>
                    </select>
                    <br/>
                    <input type='submit' onClick={e => {e.preventDefault(); createUser({variables: inputs})}}/>
                </form>
            </>
        }
        </Mutation>
    );
};