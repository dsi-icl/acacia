import * as React from 'react';
import { Mutation } from "react-apollo";
import { LOGIN, WHO_AM_I } from '../../graphql/user';
import * as css from './login.module.css';

export const LoginBox: React.FunctionComponent = props => {
    const [usernameInput, setUsernameInput] = React.useState('');
    const [passwordInput, setPasswordInput] = React.useState('');
    const [stateerror, setError] = React.useState('');
    
    function handleUsernameChange(e: any) {
        setUsernameInput(e.target.value);
    }

    function handlePasswordChange(e: any) {
        setPasswordInput(e.target.value);
    }

    return (
        <Mutation
            mutation={LOGIN}
            update={(cache, { data: { login } }) => {
                cache.writeQuery({
                    query: WHO_AM_I,
                    data: { whoAmI: login }
                })
            }}
        >
        {(login, { loading, error }) =>
            <div className={css.login_and_error_wrapper}>
            <div className={css.login_box}>
                <h1>ITMAT - BROKER</h1>
                <br/><br/>
                <div>
                    <input placeholder='username' value={usernameInput} onChange={handleUsernameChange} onKeyDown={e => e.keyCode == 13 && document.getElementById('loginButton')!.click() }/> <br/>
                </div>
                <div>
                    <input placeholder='password' type='password' value={passwordInput} onChange={handlePasswordChange} onKeyDown={e => e.keyCode == 13 && document.getElementById('loginButton')!.click() }/> <br/>
                </div>
                <br/>
                { loading ? <button>loging in..</button> :
                    (
                        <button id='loginButton' onClick={() => {login({ variables: { password: passwordInput, username: usernameInput }});}}> login</button>
                    )
                }
            </div>
            <div className={css.error_message}>
                {error ? error.message : (stateerror ? stateerror : null )}
            </div>
            </div>

        }
        </Mutation>
    );
};
