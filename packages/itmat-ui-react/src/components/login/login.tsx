import { FunctionComponent } from 'react';
import { Mutation } from '@apollo/client/react/components';
import { LOGIN, WHO_AM_I } from '@itmat-broker/itmat-models';
import { NavLink } from 'react-router-dom';
import css from './login.module.css';
import { Input, Form, Button, Alert, Checkbox } from 'antd';

export const LoginBox: FunctionComponent = () => {

    return (

        <Mutation<any, any>
            mutation={LOGIN}
            update={(cache, { data: { login } }) => {
                cache.writeQuery({
                    query: WHO_AM_I,
                    data: { whoAmI: login }
                });
            }}
            onError={() => { return; }}
        >
            {(login, { loading, error }) => {
                return (
                    <div className={css.login_wrapper}>
                        <div className={css.login_box}>
                            <img alt='IDEA-FAST Logo' src='https://avatars3.githubusercontent.com/u/60649739?s=150' />
                            <h1>Welcome</h1>
                            <br />
                            <div>
                                <Form onFinish={(variables) => login({ variables })}>
                                    <Form.Item name='username' hasFeedback rules={[{ required: true, message: ' ' }]}>
                                        <Input placeholder='Username' />
                                    </Form.Item>
                                    <Form.Item name='password' hasFeedback rules={[{ required: true, message: ' ' }]}>
                                        <Input.Password placeholder='Password' />
                                    </Form.Item>
                                    <Form.Item name='totp' hasFeedback rules={[{ required: true, len: 6, message: ' ' }]}>
                                        <Input.Password placeholder='One-Time Passcode' />
                                    </Form.Item>
                                    {error ? (
                                        <>
                                            <Alert type='error' message={error.graphQLErrors.map(error => error.message).join()} />
                                            <br />
                                        </>
                                    ) : null}
                                    {(error?.message === 'Account Expired. Please request a new expiry date!') ? (
                                        <>
                                            <Form.Item name='requestexpirydate' valuePropName='checked' hasFeedback rules={[{ required: true, message: ' ' }]}>
                                                <Checkbox> Tick the box to request a new expiry date! </Checkbox>
                                            </Form.Item>
                                            <Form.Item>
                                                <Button type='primary' disabled={loading} loading={loading} htmlType='submit'>
                                                    Submit Request
                                                </Button>
                                            </Form.Item>
                                        </>
                                    ) :
                                        <Form.Item>
                                            <Button type='primary' disabled={loading} loading={loading} htmlType='submit'>
                                                Login
                                            </Button>
                                        </Form.Item>
                                    }

                                </Form>
                            </div>
                            <br />
                            <br />
                            <br />
                            <NavLink to='/reset'>Forgot username or password</NavLink><br />
                            Do not have an account? <NavLink to='/register'>Please register</NavLink><br />
                            <i style={{ color: '#ccc' }}>v{process.env.NX_REACT_APP_VERSION} - {process.env.NX_REACT_APP_COMMIT} ({process.env.NX_REACT_APP_BRANCH})</i>
                        </div>
                    </div>
                );
            }}
        </Mutation>
    );
};
