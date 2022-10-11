import { FunctionComponent, useState } from 'react';
import { Mutation } from '@apollo/client/react/components';
import { useQuery } from '@apollo/client/react/hooks';
import { VALIDATE_RESET_PASSWORD, RESET_PASSWORD } from '@itmat-broker/itmat-models';
import { NavLink, useNavigate, useParams } from 'react-router-dom';
import css from '../login/login.module.css';
import { Input, Form, Button, Alert } from 'antd';
import LoadSpinner from '../reusable/loadSpinner';

export const ResetPasswordPage: FunctionComponent = () => {

    const { encryptedEmail, token } = useParams();
    const navigate = useNavigate();
    const [passwordSuccessfullyChanged, setPasswordSuccessfullyChanged] = useState(false);
    const { loading, error } = useQuery(VALIDATE_RESET_PASSWORD, {
        variables: {
            encryptedEmail: encryptedEmail,
            token: token
        }
    });
    if (loading) { return <LoadSpinner />; }
    if (error) {
        return <div className={css.login_wrapper}>
            <div className={css.login_box}>
                <h1>The link is invalid. Please make a new request.</h1>
                <Button onClick={() => {
                    navigate('/');
                }}>
                    Go back to login
                </Button>
                <Button onClick={() => {
                    navigate('/reset');
                }}>
                    Make a new request
                </Button>
            </div>
        </div>;
    }

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
            mutation={RESET_PASSWORD}
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
                                            navigate('/');
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
                            Do not have an account? <NavLink to='/register'>Please register</NavLink><br />
                            <i style={{ color: '#ccc' }}>v{process.env.NX_REACT_APP_VERSION} - {process.env.NX_REACT_APP_COMMIT} ({process.env.NX_REACT_APP_BRANCH})</i>
                        </div>
                    </div>
                );
            }}
        </Mutation>
    );
};
