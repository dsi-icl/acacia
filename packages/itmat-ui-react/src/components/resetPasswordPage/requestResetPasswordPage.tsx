import * as React from 'react';
import { Mutation } from '@apollo/client/react/components';
import { RouteComponentProps } from 'react-router-dom';
import { GQLRequests } from 'itmat-commons';
import css from '../login/login.module.css';

type ResetPasswordPageProps = RouteComponentProps

export const RequestResetPassword: React.FunctionComponent<ResetPasswordPageProps> = () => {
    const [usernameInput, setUsernameInput] = React.useState('');
    const [emailInput, setEmailInput] = React.useState('');
    const [stateError, setStateError] = React.useState('');
    const [forgotUsername, setForgotUsername] = React.useState(false);
    const [requestCompleted, setRequestCompleted] = React.useState(false);

    function handleUsernameChange(e: any) {
        setUsernameInput(e.target.value);
        setStateError('');
    }

    function handleEmailChange(e: any) {
        setEmailInput(e.target.value);
        setStateError('');
    }

    if (requestCompleted) {
        return (
            <div className={css.login_and_error_wrapper}>
                <div className={`${css.login_box} appear_from_below`}>
                    <h1>Done!</h1>
                    <p>{`A link for password reset ${forgotUsername ? 'together with your username ' : ''}has been sent to your email.`}</p>
                    <p>The link will be active for 1 hour.</p>
                    <br />
                </div>
            </div>
        );

    }

    return (
        <Mutation<any, any>
            mutation={GQLRequests.REQUEST_USERNAME_OR_RESET_PASSWORD}
            onError={() => { return; }}
            onCompleted={() => setRequestCompleted(true)}
        >
            {(requestPasswordReset, { loading, error }) =>
                <div className={css.login_and_error_wrapper}>
                    <div className={`${css.login_box} appear_from_below`}>
                        <h1>Forgot your password?</h1>
                        <br />
                        {
                            !forgotUsername
                                ?
                                <div>
                                    <input placeholder='username' value={usernameInput} onChange={handleUsernameChange} onKeyDown={e => e.keyCode === 13 && document.getElementById('submit_button')!.click()} /> <br />
                                    <p onClick={() => setForgotUsername(true)} style={{ cursor: 'pointer' }}>Forgot your username?</p>
                                </div>
                                :
                                <div>
                                    <input placeholder='email' type='email' value={emailInput} onChange={handleEmailChange} onKeyDown={e => e.keyCode === 13 && document.getElementById('submit_button')!.click()} /> <br />
                                </div>
                        }
                        <br />
                        {loading ? <button>loading..</button> :
                            (
                                <button
                                    id='submit_button'
                                    onClick={() => {
                                        if (!forgotUsername) {
                                            if (usernameInput === '') {
                                                setStateError('Missing username.');
                                                return;
                                            }
                                        } else {
                                            if (emailInput === '') {
                                                setStateError('Missing email.');
                                                return;
                                            }
                                        }
                                        requestPasswordReset({
                                            variables: {
                                                forgotUsername,
                                                forgotPassword: true,
                                                email: forgotUsername ? emailInput : undefined,
                                                username: forgotUsername ? undefined : usernameInput
                                            }
                                        });
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
