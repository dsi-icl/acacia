import { FunctionComponent } from 'react';
import { NavLink, useNavigate} from 'react-router-dom';
import css from './login.module.css';
import { Input, Form, Button, Alert, Checkbox, message, Image, Divider} from 'antd';
import { trpc } from '../../utils/trpc';
import LoadSpinner from '../reusable/loadSpinner';
import { useAuth } from '../../utils/dmpWebauthn/webauthn.context';
import { UserOutlined, KeyOutlined} from '@ant-design/icons';

export const LoginBox: FunctionComponent = () => {
    const login = trpc.user.login.useMutation({
        onSuccess: () => {
            window.location.reload();
        },
        onError: () => {
            void message.error('Failed to log in.');
        }
    });

    const getCurrentSubPath = trpc.domain.getCurrentSubPath.useQuery();
    const getCurrentDomain = trpc.domain.getCurrentDomain.useQuery();

    const navigate = useNavigate();
    const { isWebauthAvailable, credentials } = useAuth(); // Accessing webauthn availability and credentials

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

    const handleAuthLogin = () => {
        navigate('/authenticate_webauthn');
    };

    return (
        <div className={css.login_wrapper}>
            <div className={css.login_box}>
                <Image src={`${window.location.origin}/file/${getCurrentDomain.data?.logo}`} width={200} />
                <h1>Welcome</h1>
                <br />
                <div>
                    <Form onFinish={(variables) => { login.mutate({ ...variables, requestexpirydate: false }); }}>
                        <Form.Item name='username' hasFeedback rules={[{ required: true, message: ' ' }]}>
                            <Input placeholder='Username' />
                        </Form.Item>
                        <Form.Item name='password' hasFeedback rules={[{ required: true, message: ' ' }]}>
                            <Input.Password placeholder='Password' />
                        </Form.Item>
                        <Form.Item name='totp' hasFeedback rules={[{ required: true, len: 6, message: ' ' }]}>
                            <Input.Password placeholder='One-Time Passcode' />
                        </Form.Item>
                        {login.isError ? (
                            <>
                                <Alert type='error' message={login.error.message} />
                                <br />
                            </>
                        ) : null}
                        {(login.error?.message === 'Account Expired. Please request a new expiry date!') ? (
                            <>
                                <Form.Item name='requestexpirydate' valuePropName='checked' hasFeedback rules={[{ required: true, message: ' ' }]}>
                                    <Checkbox> Tick the box to request a new expiry date! </Checkbox>
                                </Form.Item>
                                <Form.Item>
                                    <Button type='primary' disabled={login.isLoading} loading={login.isLoading} htmlType='submit'>
                                        Submit Request
                                    </Button>
                                </Form.Item>
                            </>
                        ) :
                            <Form.Item>
                                <Button type='primary' disabled={login.isLoading} loading={login.isLoading} htmlType='submit'>
                                    Login
                                </Button>
                            </Form.Item>
                        }

                    </Form>
                </div>

                {/* Conditionally render the "Login with Authenticator" button */}
                {(isWebauthAvailable &&  credentials && credentials.length > 0) && (
                    <>
                        <Divider plain>Or</Divider>
                        <Button
                            type="default"
                            onClick={handleAuthLogin}
                            style={{
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                                width: '100%',
                                maxWidth: '280px',
                                margin: '0 auto',
                                borderColor: '#007bff',
                                color: '#007bff'
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', marginRight: '8px' }}>
                                <UserOutlined style={{ fontSize: '16px' }} />
                                <KeyOutlined style={{ fontSize: '10px', marginLeft: '1px' }} />
                            </div>
                       Login with an authenticator
                        </Button>
                    </>
                )}
                <br />
                <br />
                <br />
                <NavLink to='/reset'>Forgot username or password</NavLink><br />
                Do not have an account? <NavLink to='/register'>Please register</NavLink><br />
                <i style={{ color: '#ccc' }}>v{process.env.NX_REACT_APP_VERSION} - {process.env.NX_REACT_APP_COMMIT} ({process.env.NX_REACT_APP_BRANCH})</i>
            </div>
        </div>
    );
};
