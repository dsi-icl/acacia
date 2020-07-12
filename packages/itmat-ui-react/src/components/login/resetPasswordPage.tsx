import * as React from 'react';
import { Mutation } from 'react-apollo';
import { GQLRequests } from 'itmat-commons';
import { NavLink, RouteComponentProps, useHistory } from 'react-router-dom';
import css from '../login/login.module.css';
import { Input, Form, Button, Alert } from 'antd';

type ResetPasswordPageProps = RouteComponentProps<{
    encryptedEmail: string;
    token: string;
    expiredTime: string
}>

export const ResetPasswordPage: React.FunctionComponent<ResetPasswordPageProps> = ({ match: { params: { encryptedEmail, token, expiredTime } } }) => {
    const expiredTimeNumber = parseFloat(Buffer.from(expiredTime, 'base64').toString());
    const history = useHistory();
    const [passwordSuccessfullyChanged, setPasswordSuccessfullyChanged] = React.useState(false);

    if (passwordSuccessfullyChanged) {
        return (
            <div className={css.login_wrapper}>
                <div className={css.login_box}>
                    <img alt='IDEA-FAST Logo' src='https://avatars3.githubusercontent.com/u/60649739?s=150' />
                    <h1>You're all set!</h1>
                    <br />
                    <div>
                        <p>Your password has been successfully changed.</p>
                    </div>
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

    if (Date.now() > expiredTimeNumber) {
        return <h1>Oops, this link has expired.</h1>;
    }

    return (
        <Mutation<any, any>
            mutation={GQLRequests.RESET_PASSWORD}
            onCompleted={() => {
                setPasswordSuccessfullyChanged(true);
            }}
            onError={() => { return; }}
        >
            {(resetPassword, { loading, error }) => {
                return (

                    <div className={css.login_wrapper}>
                        <div className={css.login_box}>
                            <img alt='IDEA-FAST Logo' src='https://avatars3.githubusercontent.com/u/60649739?s=150' />
                            <h1>Reset your password</h1>
                            <br />
                            <div>
                                <Form onFinish={(variables) => resetPassword({
                                    variables: {
                                        ...variables,
                                        encryptedEmail,
                                        token
                                    }
                                })}>
                                    <Form.Item name='newPassword' hasFeedback rules={[{ required: true, message: ' ' }]}>
                                        <Input.Password placeholder='Password' />
                                    </Form.Item>
                                    <Form.Item name='newPasswordConfirm' hasFeedback dependencies={['newPassword']} rules={[
                                        { required: true, message: ' ' },
                                        ({ getFieldValue }) => ({
                                            validator(rule, value) {
                                                if (!value || getFieldValue('newPassword') === value) {
                                                    return Promise.resolve();
                                                }
                                                return Promise.reject('The two passwords that you entered do not match!');
                                            }
                                        })
                                    ]} >
                                        <Input.Password placeholder='Confirm Password' />
                                    </Form.Item>
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
                                        <Button type='primary' disabled={loading} loading={loading} htmlType='submit'>
                                            Reset my password
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
