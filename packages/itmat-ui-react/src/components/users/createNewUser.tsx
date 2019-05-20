import * as React from 'react';
import { Mutation } from 'react-apollo';
import { CREATE_USER, GET_USERS_LIST } from '../../graphql/appUsers';
import * as css from './userList.module.css';
import { NavLink } from 'react-router-dom';

// import { IUserWithoutToken } from 'itmat-utils/dist/models/user';

export const CreateNewUser: React.FunctionComponent = props => {
    const [inputs, setInputs] = React.useState({
        username: '',
        password: '',
        realName: '',
        description: '',
        emailNotificationsActivated: false,
        email: '',
        type: 'STANDARD'
    });

    const inputControl = (property: string) => ({
        value: (inputs as any)[property],
        onChange: (e: any) => { setInputs({...inputs, [property]: e.target.value }); }
    });

    return (
        <Mutation
            mutation={CREATE_USER}
            update={(cache, { data: { createUser } }) => {
                const { getUsers } = cache.readQuery({ query: GET_USERS_LIST }) as { getUsers: any[]};
                cache.writeQuery({
                    query: GET_USERS_LIST,
                    data: { getUsers: getUsers.concat([createUser]) },
                });
            }}
        >
        {(createUser, { loading, error }) =>
            <form>
                <label>Username: </label><input type='text' {...inputControl('username')}/> <br/><br/>
                <label>Password: </label><input type='password' {...inputControl('password')} /> <br/><br/>
                <label>Real name: </label><input type='text' {...inputControl('realName')}/> <br/><br/>
                <label>Description: </label><input type='text' {...inputControl('description')}/> <br/><br/>
                <label>Email: </label><input type='text' {...inputControl('email')}/> <br/><br/>
                <label>Type: </label><select {...inputControl('type')}>
                    <option value="STANDARD">System user</option>
                    <option value="ADMIN">System admin</option>
                </select>
                <br/><br/><br/><br/>
                <NavLink to='/users'><button className='button_grey'>Cancel</button></NavLink>
            { loading ? <button>Loading...</button> : <button onClick={e => {e.preventDefault(); createUser({variables: inputs})}}>Submit</button> }
            </form>
        }
        </Mutation>
    );
};