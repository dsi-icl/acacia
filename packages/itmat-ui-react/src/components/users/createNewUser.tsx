import * as React from 'react';
import { FetchResult } from '@apollo/client';
import { useMutation } from '@apollo/client/react/hooks';
import { NavLink } from 'react-router-dom';
import { CREATE_USER } from 'itmat-commons';
import css from './userList.module.css';

export const CreateNewUser: React.FunctionComponent = () => {
    const [completedCreation, setCompletedCreation] = React.useState(false);
    const [inputError, setError] = React.useState('');
    const [createUser, { loading }] = useMutation(CREATE_USER,
        { onCompleted: () => setCompletedCreation(true) }
    );
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
            setInputs({ ...inputs, [property]: e.target.value });
            setError('');
        }
    });

    function clickedSubmit(mutationFunc: (data: { variables: any }) => Promise<FetchResult<any>>) {
        return function (e: any) {
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

    if (completedCreation) {
        return (
            <div className={css.login_and_error_wrapper}>
                <div className={`${css.login_box} appear_from_below`}>
                    <h1>Registration Successful!</h1>
                    <h2>Welcome {inputs.realName} to the IDEA-FAST project</h2>
                    <br />
                    <div>
                        <p>Please check your email to setup the 2FA using an MFA authenticator app to log in.</p>
                    </div>
                    <br />
                    <NavLink to='/'><button>Go to Login</button></NavLink>
                </div>
            </div>
        );
    }

    return (
        <form>
            <label>Username: <input type='text' {...inputControl('username')} /> </label><br /><br />
            <label>Password: <input type='password' {...inputControl('password')} /> </label><br /><br />
            <label>Real name: <input type='text' {...inputControl('realName')} /> </label><br /><br />
            <label>Organisation: <input type='text' {...inputControl('organisation')} /> </label><br /><br />
            <label>Description: <input type='text' {...inputControl('description')} /> </label><br /><br />
            <label>Email: <input type='text' {...inputControl('email')} /> </label><br /><br />
            <br /><br /><br /><br />
            <div className={css.submit_cancel_button_wrapper}>
                <NavLink to='/users'><button className='button_grey'>Cancel</button></NavLink>
                {loading ? <button>Loading...</button> : <button onClick={clickedSubmit(createUser)}>Submit</button>}
            </div>
            {inputError !== '' ? <div className='error_banner'>{inputError}</div> : null}
        </form>
    );
};
