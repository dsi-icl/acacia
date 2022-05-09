import * as React from 'react';
import GitInfo from 'react-git-info/macro';
import { Mutation } from '@apollo/client/react/components';
import { NavLink, useNavigate } from 'react-router-dom';
import { GQLRequests } from 'itmat-commons';
import css from './login.module.css';
import { Input, Form, Button, Alert } from 'antd';

const gitInfo = GitInfo();

export const RequestResetPassword: React.FunctionComponent = () => {

    const navigate = useNavigate();
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
                        navigate('/');
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
                            <h1>Forgot your {forgotUsername ? 'username' : 'password'}?</h1>
                            <br />
                            <div>
                                <Form onFinish={(variables) => requestPasswordReset({
                                    variables: {
                                        ...variables,
                                        forgotUsername,
                                        forgotPassword: true
                                    }
                                })}>
                                    {forgotUsername ?
                                        <Form.Item name='email' hasFeedback rules={[{ required: true, message: ' ' }]}>
                                            <Input placeholder='Email' />
                                        </Form.Item>
                                        :
                                        <Form.Item name='username' hasFeedback rules={[{ required: true, message: ' ' }]}>
                                            <Input placeholder='Username' />
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
                                            navigate('/');
                                        }}>
                                            Cancel
                                        </Button>
                                        {forgotUsername
                                            ? <>
                                                &nbsp;&nbsp;&nbsp;
                                                <Button onClick={() => setForgotUsername(false)}>
                                                    I forgot my email
                                                </Button>
                                            </>
                                            : <>
                                                &nbsp;&nbsp;&nbsp;
                                                <Button onClick={() => setForgotUsername(true)}>
                                                    I forgot my username
                                                </Button>
                                            </>}
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
                            Do not have an account? <NavLink to='/register'>Please register</NavLink><br />
                            <i style={{ color: '#ccc' }}>v{process.env.REACT_APP_VERSION} - {gitInfo.commit.shortHash} ({gitInfo.branch})</i>
                        </div>
                    </div>
                );
            }}
        </Mutation>
    );
};
