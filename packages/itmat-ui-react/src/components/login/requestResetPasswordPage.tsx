import { FunctionComponent, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import css from './login.module.css';
import { Input, Form, Button, Alert } from 'antd';
import LoadSpinner from '../reusable/loadSpinner';
import { trpc } from '../../utils/trpc';

export const RequestResetPassword: FunctionComponent = () => {

    const navigate = useNavigate();
    const [forgotUsername, setForgotUsername] = useState(false);
    const [requestCompleted, setRequestCompleted] = useState(false);

    const getCurrentSubPath = trpc.domain.getCurrentSubPath.useQuery();
    const getCurrentDomain = trpc.domain.getCurrentDomain.useQuery();
    const requestPasswordReset = trpc.user.requestUsernameOrResetPassword.useMutation({
        onSuccess: () => {
            setRequestCompleted(true);
        },
        onError: () => {
            return;
        }
    });

    if (getCurrentSubPath.isLoading || getCurrentDomain.isLoading) {
        return <>
            <div className='page_ariane'>Loading...</div>
            <div className='page_content'>
                <LoadSpinner />
            </div>
        </>;
    }
    if (getCurrentSubPath.isError || getCurrentDomain.isError) {
        return <>
            An error occured.
        </>;
    }

    if (requestCompleted) {
        return (
            <div className={css.login_wrapper}>
                <div className={css.login_box}>
                    <img alt='' src={`${window.location.origin}/file/${getCurrentDomain.data?.logo}`} style={{ width: '200px' }} />
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
        <div className={css.login_wrapper}>
            <div className={css.login_box}>
                <img alt='' src={`${window.location.origin}/file/${getCurrentDomain.data?.logo}`} style={{ width: '200px' }} />
                <h1>Forgot your {forgotUsername ? 'username' : 'password'}?</h1>
                <br />
                <div>
                    <Form onFinish={(variables) => {
                        requestPasswordReset.mutate({
                            ...variables,
                            forgotUsername,
                            forgotPassword: true
                        });
                    }}>
                        {forgotUsername ?
                            <Form.Item name='email' hasFeedback rules={[{ required: true, message: ' ' }]}>
                                <Input placeholder='Email' />
                            </Form.Item>
                            :
                            <Form.Item name='username' hasFeedback rules={[{ required: true, message: ' ' }]}>
                                <Input placeholder='Username' />
                            </Form.Item>
                        }
                        {requestPasswordReset.isError ? (
                            <>
                                <Alert type='error' message={'An error occurred.'} />
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
                            <Button type='primary' disabled={requestPasswordReset.isLoading} loading={requestPasswordReset.isLoading} htmlType='submit'>
                                Send me a reset link
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
};
