import React, { FunctionComponent, useState, useEffect} from 'react';
import {Button, List, message } from 'antd';
import { UserOutlined, KeyOutlined } from '@ant-design/icons';

import { startAuthentication } from '@simplewebauthn/browser';
import { PublicKeyCredentialRequestOptionsJSON, AuthenticationResponseJSON } from '@simplewebauthn/types';
import LoadSpinner from '../../components/reusable/loadSpinner';
import webauthnStyles from './webauthn.module.css';

import { UserID } from './webauthn.utils';
import { useAuth } from './webauthn.context';
import { trpc } from '../../utils/trpc';

export const WebAuthnAuthenticationComponent: FunctionComponent = () => {

    const {
        credentials: webauthn_ids,
        setCredentials,
        isUserLogin,
        handleCancelRegistration
    } = useAuth();

    const [selectedUser, setSelectedUser] = useState<UserID | null>(null);
    const [userList, setUserList] = useState<UserID[]>([]);

    const webauthnAuthenticate = trpc.webauthn.webauthnAuthenticate.useMutation();
    const webauthnAuthenticateVerify = trpc.webauthn.webauthnAuthenticateVerify.useMutation();
    const webauthnLogin = trpc.webauthn.webauthnLogin.useMutation();
    const { data: webauthn_users, isLoading: webAuthnLoading, error: webAuthnError } = trpc.webauthn.getWebauthn.useQuery({ webauthn_ids: webauthn_ids || [] });
    const getCurrentDomain = trpc.domain.getCurrentDomain.useQuery();


    useEffect(() => {
        if (isUserLogin) {
            handleCancelRegistration(); // only call after render, useEffect ensures that
        }
    }, [isUserLogin, handleCancelRegistration]);

    useEffect(() => {
        if (webAuthnLoading || webAuthnError) return;
        if (webauthn_users && webauthn_users.length > 0) {
        // Filter users that have registered devices
            const usersWithDevices = webauthn_users.filter(user => user.devices && user.devices.length > 0);

            if (usersWithDevices.length > 0) {
                const modifiedUsers = usersWithDevices.map(user => ({
                    id: String(user.userId),
                    username: String(user.username)
                }));

                if(JSON.stringify(modifiedUsers) !== JSON.stringify(userList)) {
                    setUserList(modifiedUsers);
                    // Set the first user as the default selected user
                    if (!selectedUser && modifiedUsers.length > 0) {
                        setSelectedUser(modifiedUsers[0]);
                    }
                    // Clear and set unique webauthn_ids for these users
                    const uniqueCredentials = new Set(webauthn_ids);
                    usersWithDevices.forEach(webauthn => uniqueCredentials.add(webauthn.id));
                    setCredentials(Array.from(uniqueCredentials)); // Update credentials with unique values
                }
            } else {
            // If no users have devices, clear credentials and cancel the authentication dialog
                setUserList([]);
                setSelectedUser(null);
                setCredentials([]); // Clear the credentials if no users have devices
                handleCancelRegistration();
            }
        } else {
        // If there are no users at all, clear everything and cancel the dialog
            setUserList([]);
            setSelectedUser(null);
            setCredentials([]);
            handleCancelRegistration();
        }
    }, [webAuthnError, webAuthnLoading, webauthn_users]);

    if (!webauthn_ids || webauthn_ids.length === 0) {
        return <div>No credentials found.</div>; // Handle the case when there are no credentials
    }


    if (webAuthnLoading) {
        return <LoadSpinner />;
    }

    if (webAuthnError) {
        return <p>An error occurred, please contact your administrator</p>;
    }

    const handleUserSelectionChange = (value: string | null) => {
        if (value) {
            const selectedUserData: UserID = JSON.parse(value);
            setSelectedUser(selectedUserData);
        }
    };

    const handleWebAuthnAuthentication = async (event: React.FormEvent) => {
        event.preventDefault();
        const elemSuccess = document.querySelector('#authSuccess');
        const elemError = document.querySelector('#authError');

        if (elemSuccess && elemError) {
            elemSuccess.innerHTML = '';
            elemError.innerHTML = '';
        }

        if (!selectedUser) {
            if (elemError) {
                elemError.innerHTML = 'No selected Authenticator user. Please select one and try again.';
            }
            return;
        }

        try {
            const authenticationData = await webauthnAuthenticate.mutateAsync({ userId: selectedUser.id });

            const authenticationOptions: PublicKeyCredentialRequestOptionsJSON = authenticationData;

            const assertionResponse: AuthenticationResponseJSON = await startAuthentication(authenticationOptions);
            const verificationData = await webauthnAuthenticateVerify.mutateAsync({
                userId: selectedUser.id,
                assertionResponse
            });

            const verificationResult = verificationData;

            if (verificationResult.successful) {
                void message.success('Authenticator login successful!');
                try {
                    await webauthnLogin.mutateAsync({ userId: selectedUser.id });
                    window.location.href = '/datasets';
                    handleCancelRegistration();
                } catch (error) {
                    if (elemError) {
                        elemError.innerHTML = `Authenticator login error: <pre>${JSON.stringify(error)}</pre>`;
                    }
                }
            } else {
                if (elemError) {
                    elemError.innerHTML = `Authentication failed! Response: <pre>${JSON.stringify(verificationResult)}</pre>`;
                }
            }
        } catch (error: unknown) {
            if (error instanceof Error) {
                if (elemError) {
                    elemError.innerHTML = `Error occurred: <pre>${error.message}</pre>`;
                }
            } else {
                if (elemError) {
                    elemError.innerHTML = 'An unexpected error occurred';
                }
            }
        }
    };

    return (
        <div>
            <div className={webauthnStyles.registration_dialog}>
                <img
                    src={`${window.location.origin}/file/${getCurrentDomain.data?.logo}`}
                    width={200}
                    alt="Logo"
                />
                <div className={webauthnStyles.userIconWrapper}>
                    <div style={{ display: 'flex', alignItems: 'center', marginRight: '8px' }}>
                        <UserOutlined style={{ fontSize: '32px' }} />
                        <KeyOutlined style={{ fontSize: '16px', marginLeft: '1px' }} />
                    </div>
                    <h3 style={{ marginTop: '10px' }}>Authenticator User</h3>
                </div>
                <br />
                <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #ccc', borderRadius: '5px', padding: '10px' }}>
                    <List
                        bordered
                        dataSource={userList}
                        renderItem={(user) => (
                            <List.Item
                                key={user.id}
                                style={{
                                    cursor: 'pointer',
                                    padding: '10px',
                                    backgroundColor: selectedUser?.id === user.id ? '#f0f0f0' : '#fff',
                                    display: 'flex',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    textAlign: 'center',
                                    border: `1px solid ${selectedUser?.id === user.id ? '#007bff' : '#ccc'}`, // Set border color
                                    borderRadius: '5px'
                                }}
                                onClick={() => handleUserSelectionChange(JSON.stringify(user))}
                            >
                                <span style={{
                                    maxWidth: '150px', // Adjust width based on available space
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis', // Truncates text with ellipsis
                                    display: 'inline-block',
                                    color: selectedUser?.id === user.id ? '#007bff' : '#000' // Set text color
                                }}>
                                    {user.username}
                                </span>
                            </List.Item>
                        )}
                    />
                </div>
                <p className="success" id="authSuccess"></p>
                <p className="error" id="authError"></p>
            </div>
            <div className={webauthnStyles.primaryButton}>
                <Button key="cancel" onClick={handleCancelRegistration} size='large'>
                    Cancel
                </Button>
                <Button
                    key="yes"
                    type="primary"
                    onClick={(event) => { void handleWebAuthnAuthentication(event); }}
                    size='large'>
                    Authenticate
                </Button>
            </div>
        </div>

    );
};

