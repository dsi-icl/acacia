import * as React from 'react';
import { Mutation } from '@apollo/client/react/components';
import { GQLRequests } from 'itmat-commons';
import { NavLink, RouteComponentProps } from 'react-router-dom';
import css from '../login/login.module.css';

type ResetPasswordPageProps = RouteComponentProps<{
    encryptedEmail: string;
    token: string;
}>

export const ResetPasswordPage: React.FunctionComponent<ResetPasswordPageProps> = ({ match: { params: { encryptedEmail, token } } }) => {
    const [passwordInput, setPasswordInput] = React.useState('');
    const [stateError, setStateError] = React.useState('');
    const [passwordSuccessfullyChanged, setPasswordSuccessfullyChanged] = React.useState(false);

    function handlePasswordChange(e: any) {
        setPasswordInput(e.target.value);
        setStateError('');
    }

    if (passwordSuccessfullyChanged) {
        return (
            <div className={css.login_and_error_wrapper}>
                <div className={`${css.login_box} appear_from_below`}>
                    <h1>You're all set!</h1>
                    <br />
                    <div>
                        <p>Your password has been successfully changed.</p>
                    </div>
                    <br />
                    <NavLink to='/'><button>Go to Login</button></NavLink>
                </div>
            </div>
        );
    }

    return (
        <Mutation<any, any>
            mutation={GQLRequests.RESET_PASSWORD}
            onCompleted={() => {
                setPasswordSuccessfullyChanged(true);
            }}
            onError={() => { return; }}
        >
            {(resetPassword, { loading, error }) =>
                <div className={css.login_and_error_wrapper}>
                    <div className={`${css.login_box} appear_from_below`}>
                        <h1>Reset you password</h1>
                        <br />
                        <div>
                            <label htmlFor='password_input'>Enter new password:</label><br />
                            <input id='password_input' placeholder='password' type='password' value={passwordInput} onChange={handlePasswordChange} onKeyDown={e => e.keyCode === 13 && document.getElementById('submit_button')!.click()} /> <br />
                        </div>
                        <br />
                        {loading ? <button>Loading...</button> :
                            (
                                <button
                                    id='submit_button'
                                    onClick={() => {
                                        if (passwordInput.length < 8) {
                                            setStateError('Password must have at least 8 characters');
                                            return;
                                        }
                                        resetPassword({ variables: { newPassword: passwordInput, encryptedEmail, token } });
                                    }}
                                >Reset my password</button>
                            )
                        }
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
