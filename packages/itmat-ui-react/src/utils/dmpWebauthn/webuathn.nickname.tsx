import React, { FunctionComponent, useState, useEffect } from 'react';
import { Input, Button, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './webauthn.context';
import { trpc } from '../trpc';
import css from './webauthn.module.css';

export const DeviceNicknameComponent: FunctionComponent = () => {
    const { newDeviceId } = useAuth();
    const navigate = useNavigate();
    const [deviceName, setDeviceName] = useState('');

    useEffect(() => {
        if (!newDeviceId) {
            // If there's no new device registered, redirect to another page (like dashboard or registration)
            void message.error('No new device registered.');
            navigate('/'); // Redirect to a desired route
        }
    }, [newDeviceId, navigate]);


    const updateDeviceNameMutation = trpc.webauthn.updateWebauthnDeviceName.useMutation();
    const getCurrentDomain = trpc.domain.getCurrentDomain.useQuery();

    const handleSetDeviceNickname = async () => {
        if (deviceName && newDeviceId) {
            try {
                await updateDeviceNameMutation.mutateAsync({
                    deviceId: newDeviceId,
                    name: deviceName
                });
                void message.success('Device nickname updated.');
                handleCancel();
            } catch {
                void message.error('Failed to update device nickname.');
            }
        }
    };

    const handleCancel = () => {
        navigate('/profile'); // Redirect to user profile route
    };


    return (
        <div>
            <div className={css.registration_dialog}>
                <img
                    src={`${window.location.origin}/file/${getCurrentDomain.data?.logo}`}
                    width={200}
                    alt="Logo"
                />
                <h3>Pick a Nickname for Your Device</h3>
                <p>Please pick a nickname that will help you identify this registered device later.</p>
                <p>For example, the name of your device or laptop.</p>
                <Input
                    value={deviceName}
                    onChange={(e) => setDeviceName(e.target.value)}
                    placeholder="Enter a nickname for your device"
                />
            </div>
            <div className={css.primaryButton}>
                <Button key="cancel" onClick={handleCancel} size='large'>
                    Later
                </Button>
                <Button
                    key="save"
                    type="primary"
                    onClick={() => void handleSetDeviceNickname()}
                    size='large'
                >
                    Save
                </Button>
            </div>
        </div>
    );
};
