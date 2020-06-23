import * as React from 'react';
import { Mutation } from 'react-apollo';
import { RouteComponentProps, NavLink, useHistory } from 'react-router-dom';
import { GQLRequests } from 'itmat-commons';
import css from './login.module.css';
import { Input, Form, Button, Alert } from 'antd';

type ResetPasswordPageProps = RouteComponentProps

export const RequestResetPassword: React.FunctionComponent<ResetPasswordPageProps> = () => {

    const history = useHistory();
    const [forgotUsername, setForgotUsername] = React.useState(false);
    const [requestCompleted, setRequestCompleted] = React.useState(false);

    if (requestCompleted) {
        return (
            <div className={css.login_wrapper}>
                <div className={css.login_box}>
                    <img alt='IDEA-FAST Logo' src='https://avatars3.githubusercontent.com/u/60649739?s=150' />
                    <h1>Done!</h1>
                    <br />
                    <p>{`A link for password reset ${forgotUsername ? 'together with your username ' : ''}has been sent to your email.`}</p>
                    <p>The link will be active for 1 hour.</p>
                    <br />
                    <Button onClick={() => {
                        history.push('/');
                    }}>
                        Go back to login
                    </Button>
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
            {(requestPasswordReset, { loading, error }) => {
                return (
                    <div className={css.login_wrapper}>
                        <div className={css.login_box}>
                            <img alt='IDEA-FAST Logo' src='https://avatars3.githubusercontent.com/u/60649739?s=150' />
                            <h1>Forgot your password?</h1>
                            <br />
                            <div>
                                <Form onFinish={(variables) => requestPasswordReset({
                                    variables: {
                                        ...variables,
                                        forgotUsername,
                                        forgotPassword: true
                                    }
                                })}>
                                    {!forgotUsername ?
                                        <Form.Item name='username' hasFeedback rules={[{ required: true, message: ' ' }]}>
                                            <Input placeholder='Username' />
                                        </Form.Item>
                                        :
                                        <Form.Item name='email' hasFeedback rules={[{ required: true, message: ' ' }]}>
                                            <Input placeholder='Email' />
                                        </Form.Item>
                                    }
                                    {error ? (
                                        <>
                                            <Alert type='error' message={error.graphQLErrors.map(error => error.message).join()} />
                                            <br />
                                        </>
                                    ) : null}
                                    <Form.Item>
                                        <Button onClick={() => {
                                            history.push('/');
                                        }}>
                                            Cancel
                                        </Button>
                                        &nbsp;&nbsp;&nbsp;
                                        <Button onClick={() => setForgotUsername(true)}>
                                            I forgot my username
                                        </Button>
                                        &nbsp;&nbsp;&nbsp;
                                        <Button type='primary' disabled={loading} loading={loading} htmlType='submit'>
                                            Send me a reset link
                                        </Button>
                                    </Form.Item>
                                </Form>
                            </div>
                            <br />
                            <br />
                            <br />
                            Do not have an account? <NavLink to='/register'>Please register</NavLink>
                        </div>
                    </div>
                );
            }}
        </Mutation>
    );
};
