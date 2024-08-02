import React, { FunctionComponent} from 'react';
import { Button, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import { UserOutlined, KeyOutlined } from '@ant-design/icons';

import { startRegistration } from '@simplewebauthn/browser';
import {
    RegistrationResponseJSON,
    PublicKeyCredentialCreationOptionsJSON
} from '@simplewebauthn/types';

import webauthnStyles from './webauthn.module.css';
import { useAuth } from './webauthn.context';
import { trpc } from '../../utils/trpc';

export const WebAuthnRegistrationComponent: FunctionComponent = () => {
    const {
        credentials,
        setCredentials,
        handleCancelRegistration,
        isUserLogin,
        setNewDeviceId
    } = useAuth();
    const nagivate = useNavigate();

    const webauthnRegistration = trpc.webauthn.webauthnRegister.useMutation();
    const webauthnRegisterVerify = trpc.webauthn.webauthnRegisterVerify.useMutation();

    const { refetch: fetchWebAuthnID } = trpc.webauthn.getWebauthnID.useQuery(undefined, {
        enabled: false,
        onSuccess: (data) => {
            if (data === null) {
                void message.warning('No Authenticator ID found for the user.');
                return;
            }
            const webauthnID = data?.id;
            const updatedCredentials = credentials ? [...credentials] : [];
            // if device is not null and webauthnID is not in the credentials, add it to the credentials
            if (webauthnID && data.devices.length!==0 && !updatedCredentials.includes(webauthnID)) {
                updatedCredentials.push(webauthnID);
                setCredentials(updatedCredentials);
            }
        },
        onError: () => {
            void message.error('Failed to fetch Authenticator ID.');
        }
    });

    const handleWebAuthnRegistration = async (event: React.FormEvent) => {
        event.preventDefault();

        const elemSuccess = document.querySelector('#regSuccess');
        const elemError = document.querySelector('#regError');
        let webauthn_id: string | undefined; // add webauthn_id to the browser's local storage as needed
        let device_id: string | undefined; // the device ID to be used for the nickname

        if (!isUserLogin) {
            if (elemError) {
                elemError.innerHTML = 'There is no login user, please login and try again';
            }
            return;
        }

        try {
            if (elemSuccess && elemError) {
                elemSuccess.innerHTML = '';
                elemError.innerHTML = '';
            }

            const registrationData = await webauthnRegistration.mutateAsync();
            webauthn_id = registrationData.webauthn_id;
            const registrationOptions: PublicKeyCredentialCreationOptionsJSON = registrationData.options;
            const attestationResponse: RegistrationResponseJSON = await startRegistration(registrationOptions);

            const verificationData = await webauthnRegisterVerify.mutateAsync({
                attestationResponse
            });

            const verificationResult = verificationData;

            if (verificationResult.successful) {
                if (elemSuccess) {
                    elemSuccess.innerHTML = 'Authenticator registered successfully!';
                }

                device_id = verificationResult.id;
                //webauthn_id not in credentials
                if (webauthn_id && !credentials?.includes(webauthn_id)) { // Ensure id is defined
                    const updatedCredentials = [
                        ...(credentials ?? []),
                        webauthn_id
                    ];
                    setCredentials(updatedCredentials);

                    void message.success('Registration verified.');
                    setNewDeviceId(device_id); // Set the device ID for the nickname
                    // Redirect to the device nickname route
                    nagivate('/nickname_webauthn');

                } else {
                    void message.error('Authenticator ID is undefined.');
                }
            } else {
                if (elemError) {
                    elemError.innerHTML = `Oh no, something wrong! Response: <pre>${JSON.stringify(verificationResult)}</pre>`;
                }
            }
        } catch (error: unknown) {
            if (error instanceof Error) {
                if (error.name === 'InvalidStateError') {
                    await fetchWebAuthnID(); // Fetch the webauthn ID if the user has already registered the device
                    if (elemError) {
                        elemError.innerHTML = 'This device has already been registered. You don\'t need to register it again!';
                    }
                    if (webauthn_id && !credentials?.includes(webauthn_id)) { // Ensure id is available
                        setCredentials([
                            ...(credentials ?? []),
                            webauthn_id
                        ]);
                    }
                } else {
                    if (elemError) {
                        elemError.innerHTML = `Error occurred: ${(error as Error).message || 'Unknown error'}`;
                    }
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
                <img alt='IDEA-FAST Logo' src='https://avatars3.githubusercontent.com/u/60649739?s=150' />
                <div className={webauthnStyles.userIconWrapper}>
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                        <KeyOutlined style={{ fontSize: '16px', marginRight: '-8px' }} />
                        <UserOutlined style={{ fontSize: '32px', marginLeft: '8px' }} />
                    </div>
                    <h3 style={{ marginTop: '10px', textAlign: 'center' }}>Register new Authenticator?</h3>
                </div>

                <p className="success" id="regSuccess"></p>
                <p className="error" id="regError"></p>
            </div>
            <div className={webauthnStyles.primaryButton}>
                <Button key="no" onClick={handleCancelRegistration} size='large'>
                            Cancel
                </Button>
                <Button key="yes" type="primary" onClick={(event) => { void handleWebAuthnRegistration(event); }} size='large'>
                            Register
                </Button>
            </div>

        </div>
    );
};
