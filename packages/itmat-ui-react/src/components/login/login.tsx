import * as React from 'react';
import { Mutation } from '@apollo/client/react/components';
import { LOGIN, WHO_AM_I } from 'itmat-commons';
import { NavLink } from 'react-router-dom';
import css from './login.module.css';
import './login.global.css';

export const LoginBox: React.FunctionComponent = () => {
    const [usernameInput, setUsernameInput] = React.useState('');
    const [passwordInput, setPasswordInput] = React.useState('');
    const [totpInput, setTotpInput] = React.useState('');
    const [stateError, setStateError] = React.useState('');

    function handleUsernameChange(e: any) {
        setUsernameInput(e.target.value);
        setStateError('');
    }

    function handlePasswordChange(e: any) {
        setPasswordInput(e.target.value);
        setStateError('');
    }

    function handleTotpChange(e: any) {
        setTotpInput(e.target.value);
    }

    return (
        <Mutation<any, any>
            mutation={LOGIN}
            update={(cache, { data: { login } }) => {
                cache.writeQuery({
                    query: WHO_AM_I,
                    data: { whoAmI: login }
                });
            }}
            onError={() => { return; }}
        >
            {(login, { loading, error }) =>
                <div className={css.login_and_error_wrapper}>
                    <div className={css.top + ' appear_from_left'}></div>
                    <div className={css.bottom + ' appear_from_right'}></div>
                    <div className={`${css.login_box} appear_from_below`}>
                        <h1>NAME</h1>
                        <p>A secure and high-performance clinical data storage and analysis platform</p>
                        <br />
                        <div>
                            <input id='username_input' placeholder='username' value={usernameInput} onChange={handleUsernameChange} onKeyDown={e => e.keyCode === 13 && document.getElementById('loginButton')!.click()} /> <br />
                        </div>
                        <div>
                            <input id='password_input' placeholder='password' type='password' value={passwordInput} onChange={handlePasswordChange} onKeyDown={e => e.keyCode === 13 && document.getElementById('loginButton')!.click()} /> <br />
                        </div>
                        <div>
                            <input id='totp_input' placeholder='totp' type='password' value={totpInput} onChange={handleTotpChange} onKeyDown={e => e.keyCode === 13 && document.getElementById('loginButton')!.click()} /> <br />
                        </div>
                        <br />
                        {loading ? <button>logging in..</button> :
                            (
                                <button
                                    id='loginButton'
                                    onClick={() => {
                                        if (usernameInput === '') {
                                            setStateError('Missing username.');
                                            return;
                                        }
                                        if (passwordInput === '') {
                                            setStateError('Missing password.');
                                            return;
                                        }
                                        login({ variables: { password: passwordInput, username: usernameInput, totp: totpInput } });
                                    }}
                                >Login</button>
                            )
                        }
                        <br />
                        <NavLink to='/requestResetPassword'><p>Forgot username or password</p></NavLink>
                        <br />
                        <br />
                        <NavLink to='/userRegistration'><strong>Do not have an account? Please register</strong></NavLink>
                        <br />
                        <br />
                        <div id='error_dialog' className={css.error_message}>
                            {error ? error.message : (stateError ? stateError : null)}
                        </div>
                    </div>
                </div>

            }
        </Mutation>
    );
};
