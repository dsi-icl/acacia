import React, { useState, createContext, useContext, FunctionComponent, ReactNode, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLocalForage } from './useLocalStorage'; // Adjust the path as needed

import {
    browserSupportsWebAuthn,
    platformAuthenticatorIsAvailable
} from '@simplewebauthn/browser';

interface AuthContextState {

    handleCancelRegistration: () => void;

    // webauthn credentials locally stored
    credentials: Array<string> | null;
    setCredentials: (value: Array<string>) => void;

    // webauthn availability
    isWebauthAvailable: null | boolean;
    setIsWebauthAvailable: (value: null | boolean) => void;
    // user login status
    isUserLogin: boolean;
    setIsUserLogin: (value: boolean) => void;

    newDeviceId: string | undefined;
    setNewDeviceId: (id: string | undefined) => void;
}

const AuthContext = createContext<AuthContextState | undefined>(undefined);

interface AuthProviderProps {
    children: ReactNode;
}

export const AuthProvider: FunctionComponent<AuthProviderProps> = ({ children }) => {

    const [credentials, setCredentials, , isLoading] = useLocalForage<Array<string>>('enrolledCredentials', []);

    const [isWebauthAvailable, setIsWebauthAvailable] = useState<null | boolean>(null);
    const [isUserLogin, setIsUserLogin] = useState<boolean>(false);
    const [newDeviceId, setNewDeviceId] = useState<string | undefined>('');

    const navigate = useNavigate();

    const handleCancelRegistration = () => {
        navigate('/datasets');
    };

    useEffect(() => {
        if (isWebauthAvailable === null) {
            setIsWebauthAvailable(false);
            Promise.all([
                browserSupportsWebAuthn(),
                platformAuthenticatorIsAvailable()
            ])
                .then(statuses => statuses.reduce((prev, curr) => curr && prev, true))
                .then((result) => {
                    setIsWebauthAvailable(result);
                })
                .catch(() => setIsWebauthAvailable(false));
        }
    }, [isWebauthAvailable]);

    // Show a loading screen or spinner until credentials are loaded
    if (isLoading) {
        return <div>Loading...</div>; // Replace with any spinner or loading UI
    }

    return (
        <AuthContext.Provider value={{
            handleCancelRegistration,
            credentials,
            setCredentials,
            isWebauthAvailable,
            setIsWebauthAvailable,
            isUserLogin,
            setIsUserLogin,
            newDeviceId,
            setNewDeviceId
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = (): AuthContextState => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
