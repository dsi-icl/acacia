import * as React from 'react';
import { useMutation } from '@apollo/client/react/hooks';
import { NavLink, useHistory } from 'react-router-dom';
import { CREATE_USER } from 'itmat-commons';
import { Input, Form, Button, Alert, Checkbox, Select } from 'antd';
import css from './login.module.css';
import { sites } from '../datasetDetail/tabContent/files/fileTab';

export const RegisterNewUser: React.FunctionComponent = () => {

    const history = useHistory();
    const [completedCreation, setCompletedCreation] = React.useState(false);
    const [createUser, { loading, error }] = useMutation(CREATE_USER,
        { onCompleted: () => setCompletedCreation(true) }
    );

    if (completedCreation) {
        return (
            <div className={css.login_wrapper}>
                <div className={css.login_box}>
                    <img alt='IDEA-FAST Logo' src='https://avatars3.githubusercontent.com/u/60649739?s=150' />
                    <h1>Registration Successful!</h1>
                    <br />
                    <div>
                        <p>Please check your email for instruction to setup you MFA application.</p>
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

    console.error('PLOP>', error);
    console.error('PLOP GRA>', error?.graphQLErrors);
    console.error('PLOP NET>', error?.networkError);

    return (
        <div className={css.login_wrapper}>
            <div className={css.login_box}>
                <img alt='IDEA-FAST Logo' src='https://avatars3.githubusercontent.com/u/60649739?s=150' />
                <h1>Register an Account</h1>
                <br />
                <div>
                    <Form layout='vertical' onFinish={(variables) => createUser({ variables })}>
                        <Form.Item name='username' hasFeedback rules={[{ required: true, message: 'Please enter a username' }]}>
                            <Input placeholder='Username' />
                        </Form.Item>
                        <Form.Item name='password' hasFeedback rules={[{ required: true, message: 'Please enter a password' }]}>
                            <Input.Password placeholder='Password' />
                        </Form.Item>
                        <Form.Item name='passwordConfirm' hasFeedback dependencies={['password']} rules={[
                            { required: true, message: 'Please confirm the password' },
                            ({ getFieldValue }) => ({
                                validator(rule, value) {
                                    if (!value || getFieldValue('password') === value) {
                                        return Promise.resolve();
                                    }
                                    return Promise.reject('The two passwords that you entered do not match!');
                                }
                            })
                        ]} >
                            <Input.Password placeholder='Confirm Password' />
                        </Form.Item>
                        <Form.Item name='email' hasFeedback rules={[{ required: true, type: 'email', message: 'Please enter a valid email address' }]} >
                            <Input placeholder='Email' />
                        </Form.Item>
                        <Form.Item name='firstname' hasFeedback rules={[{ required: true, message: 'Please enter your firstname' }]} >
                            <Input placeholder='Firstname' />
                        </Form.Item>
                        <Form.Item name='lastname' hasFeedback rules={[{ required: true, message: 'Please enter your lastname' }]}>
                            <Input placeholder='Lastname' />
                        </Form.Item>
                        <Form.Item name='organisation' hasFeedback rules={[{ required: true, message: 'Please select your organisation' }]}>
                            <Select placeholder='Organisation'>
                                {Object.entries(sites).map((site) => <Select.Option key={site[0]} value={site[0]}>{site[1]}</Select.Option>)}
                            </Select>
                        </Form.Item>
                        <Form.Item name='emailNotificationsActivated' valuePropName='checked'>
                            Subscribe to email notifications <Checkbox />
                        </Form.Item>
                        {error ? (
                            <>
                                <Alert type='error' message={error.graphQLErrors.map(error => error.message).join()} />
                                <Alert type='error' message={error.networkError?.message} />
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
                                Create
                            </Button>
                        </Form.Item>
                    </Form>
                </div>
                <br />
                <br />
                <br />
                <NavLink to='/reset'>Forgot username or password</NavLink><br />
                Do you have an account? <NavLink to='/'>Go to the login page</NavLink>
            </div>
        </div>
    );
};
