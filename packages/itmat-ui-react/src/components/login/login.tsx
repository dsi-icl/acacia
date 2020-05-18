import * as React from 'react';
import { Mutation } from 'react-apollo';
import { LOGIN, WHO_AM_I } from 'itmat-commons/dist/graphql/user';
import css from './login.module.css';
import './login.global.css';

export const LoginBox: React.FunctionComponent = () => {
    const [usernameInput, setUsernameInput] = React.useState('');
    const [passwordInput, setPasswordInput] = React.useState('');
    const [stateError] = React.useState('');

    function handleUsernameChange(e: any) {
        setUsernameInput(e.target.value);
    }

    function handlePasswordChange(e: any) {
        setPasswordInput(e.target.value);
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
            onError={() => {}}
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
                        <br />
                        {loading ? <button>logging in..</button> :
                            (
                                <button id='loginButton' onClick={() => { login({ variables: { password: passwordInput, username: usernameInput } }); }}>Login</button>
                            )
                        }
                        <div id='error_dialog' className={css.error_message}>
                            {error ? error.message : (stateError ? stateError : null)}
                        </div>
                    </div>
                </div>

            }
        </Mutation>
    );
};
