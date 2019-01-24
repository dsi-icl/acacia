import * as React from 'react';
import { Mutation } from "react-apollo";
import { LOGIN, WHO_AM_I } from '../graphql/user';
import * as css from '../css/login.module.css';

export const LoginBox: React.FunctionComponent = props => {
    const [usernameInput, setUsernameInput] = React.useState('');
    const [passwordInput, setPasswordInput] = React.useState('');
    
    function handleUsernameChange(e: any) {
        setUsernameInput(e.target.value);
    }

    function handlePasswordChange(e: any) {
        setPasswordInput(e.target.value);
    }

    return (<div className={css.loginBox}>
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
            <>
                Username: <input value={usernameInput} onChange={handleUsernameChange}/> <br/>
                Password: <input type='password' value={passwordInput} onChange={handlePasswordChange}/> <br/>
                { loading ? <p> Loading.. </p> :
                    (
                        <><button onClick={() => {login({ variables: { password: passwordInput, username: usernameInput }});}}> login</button>
                        {error ? <p>{error.message}</p> : null}</>
                    )
                }
            </>
        }
        </Mutation>
    </div>);
};
