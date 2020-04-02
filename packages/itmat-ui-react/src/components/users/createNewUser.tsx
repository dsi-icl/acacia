import * as React from 'react';
import { useMutation } from 'react-apollo';
import { NavLink, Redirect } from 'react-router-dom';
import { CREATE_USER, GET_USERS } from 'itmat-commons/dist/graphql/appUsers';
import css from './userList.module.css';

export const CreateNewUser: React.FunctionComponent = (props) => {
    const [completedCreationId, setCompletedCreationId] = React.useState(undefined);
    const [inputError, setError] = React.useState('');
    const [createUser, { loading }] = useMutation(CREATE_USER, {
        refetchQueries: [{ query: GET_USERS, variables: { fetchDetailsAdminOnly: false, fetchAccessPrivileges: false } }],
        onCompleted: (data) => setCompletedCreationId(data.createUser.id),
    });
    const [inputs, setInputs]: [{ [key: string]: any }, any] = React.useState({
        username: '',
        password: '',
        realName: '',
        organisation: '',
        description: '',
        emailNotificationsActivated: false,
        email: '',
        type: 'STANDARD',
    });

    const inputControl = (property: string) => ({
        value: inputs[property],
        onChange: (e: any) => {
            setInputs({ ...inputs, [property]: e.target.value });
            setError('');
        },
    });

    function clickedSubmit(mutationFunc: (data: { variables: any }) => {}) {
        return (e: any) => {
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

    if (completedCreationId) { return <Redirect to={`/users/${completedCreationId}`} />; }

    return (
        <form>
            <label>
                Username:
                <input type="text" {...inputControl('username')} />
            </label>
            <br />
            <br />
            <label>
                Password:
                <input type="password" {...inputControl('password')} />
            </label>
            <br />
            <br />
            <label>
                Real name:
                <input type="text" {...inputControl('realName')} />
            </label>
            <br />
            <br />
            <label>
                Organisation:
                <input type="text" {...inputControl('organisation')} />
            </label>
            <br />
            <br />
            <label>
                Description:
                <input type="text" {...inputControl('description')} />
            </label>
            <br />
            <br />
            <label>
                Email:
                <input type="text" {...inputControl('email')} />
            </label>
            <br />
            <br />
            <label>
                Type:
                <select {...inputControl('type')}>
                    <option value="STANDARD">System user</option>
                    <option value="ADMIN">System admin</option>
                </select>
            </label>
            <br />
            <br />
            <br />
            <br />
            <div className={css.submit_cancel_button_wrapper}>
                <NavLink to="/users"><button className="button_grey">Cancel</button></NavLink>
                {loading ? <button>Loading...</button> : <button onClick={clickedSubmit(createUser)}>Submit</button>}
            </div>
            {inputError !== '' ? <div className="error_banner">{inputError}</div> : null}
        </form>
    );
};
