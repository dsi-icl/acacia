import * as React from 'react';
import { Mutation } from 'react-apollo';
import { NavLink, Redirect } from 'react-router-dom';
import { CREATE_USER, GET_USERS } from '../../graphql/appUsers';
import * as css from './userList.module.css';

// import { IUserWithoutToken } from 'itmat-utils/dist/models/user';

export const CreateNewUser: React.FunctionComponent = (props) => {
    const [completedCreationId, setCompletedCreationId] = React.useState(undefined);
    const [inputError, setError] = React.useState('');
    const [inputs, setInputs]: [{ [key: string]: any }, any] = React.useState({
        username: '',
        password: '',
        realName: '',
        organisation: '',
        description: '',
        emailNotificationsActivated: false,
        email: '',
        type: 'STANDARD'
    });

    const inputControl = (property: string) => ({
        value: inputs[property],
        onChange: (e: any) => {
            setInputs({...inputs, [property]: e.target.value });
            setError('');
        }
    });

    function clickedSubmit(mutationFunc: (data: { variables: any }) => {}) {
        return function(e: any) {
            e.preventDefault();
            const allFields = Object.keys(inputs);
            for (const each of allFields) {
                if (inputs[each] === undefined || inputs[each] === '') {
                    setError('None of the fields can be empty!');
                    return;
                }
            }
            mutationFunc({ variables: inputs });
        };
    }

    if (completedCreationId) { return <Redirect to={`/users/${completedCreationId}`}/>; }

    return (
        <Mutation
            mutation={CREATE_USER}
            refetchQueries={[{ query: GET_USERS, variables: { fetchDetailsAdminOnly: false, fetchAccessPrivileges: false} }]}
            onCompleted={(data) => setCompletedCreationId(data.createUser.id)}
        >
        {(createUser, { loading, error }) =>
            <form>
                <label>Username: </label><input type="text" {...inputControl('username')}/> <br/><br/>
                <label>Password: </label><input type="password" {...inputControl('password')} /> <br/><br/>
                <label>Real name: </label><input type="text" {...inputControl('realName')}/> <br/><br/>
                <label>Organisation: </label><input type="text" {...inputControl('organisation')}/> <br/><br/>
                <label>Description: </label><input type="text" {...inputControl('description')}/> <br/><br/>
                <label>Email: </label><input type="text" {...inputControl('email')}/> <br/><br/>
                <label>Type: </label><select {...inputControl('type')}>
                    <option value="STANDARD">System user</option>
                    <option value="ADMIN">System admin</option>
                </select>
                <br/><br/><br/><br/>
                <div className={css.submit_cancel_button_wrapper}>
                    <NavLink to="/users"><button className="button_grey">Cancel</button></NavLink>
                    { loading ? <button>Loading...</button> : <button onClick={clickedSubmit(createUser)}>Submit</button> }
                </div>
            { inputError !== '' ? <div className="error_banner">{inputError}</div> : null }
            </form>
        }
        </Mutation>
    );
};
