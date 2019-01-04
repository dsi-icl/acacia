import * as React from 'react';
import { Mutation } from "react-apollo";
import { LOGIN } from '../graphql/mutations/user';

export const LoginBox: React.FunctionComponent<{refetch: Function}> = props => {
    const [usernameInput, setUsernameInput] = React.useState('');
    const [passwordInput, setPasswordInput] = React.useState('');
    
    function handleUsernameChange(e: any) {
        setUsernameInput(e.target.value);
    }

    function handlePasswordChange(e: any) {
        setPasswordInput(e.target.value);
    }

    return (<div className='loginName'>
        <Mutation mutation={LOGIN}>
        {(login, { data }) =>
            <>
                Username: <input value={usernameInput} onChange={handleUsernameChange}/> <br/>
                Password: <input value={passwordInput} onChange={handlePasswordChange}/> <br/>
                <button onClick={() => {login({ variables: { password: passwordInput, username: usernameInput}});}}> login</button>
            </>
        }
        </Mutation>
    </div>);
};
