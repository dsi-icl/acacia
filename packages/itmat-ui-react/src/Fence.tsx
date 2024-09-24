import { FunctionComponent, useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { LoginBox } from './components/login/login';
import { MainMenuBar } from './components/scaffold/mainMenuBar';
import { MainPanel } from './components/scaffold/mainPanel';
import css from './components/scaffold/scaffold.module.css';
import { ResetPasswordPage } from './components/login/resetPasswordPage';
import { RequestResetPassword } from './components/login/requestResetPasswordPage';
import { RegisterNewUser } from './components/login/register';
import LoadSpinner from './components/reusable/loadSpinner';
import { StatusBar } from './components/scaffold/statusBar';
import { trpc } from './utils/trpc';

import { WebAuthnRegistrationComponent } from './utils/dmpWebauthn/webauthn.register';
import { WebAuthnAuthenticationComponent } from './utils/dmpWebauthn/webauthn.authenticate';
import { DeviceNicknameComponent } from './utils/dmpWebauthn/webuathn.nickname';
import { useAuth } from './utils/dmpWebauthn/webauthn.context';


export const Fence: FunctionComponent = () => {
    const {
        isUserLogin,
        setIsUserLogin
    } = useAuth();

    const whoAmI = trpc.user.whoAmI.useQuery();
    const recoverSession = trpc.user.recoverSessionExpireTime.useQuery(undefined, {
        refetchInterval: 60 * 60 * 1000
    });

    const [component, setComponent] = useState<JSX.Element | null>(null);

    const isAnyLoading = whoAmI.isLoading;

    const hasError = whoAmI.isError || recoverSession.isError;
    const errorMessage = whoAmI.error?.message ?? '';

    useEffect(() => {
        if (whoAmI.data !== null && whoAmI.data !== undefined) {
            setIsUserLogin(true);
        } else {
            setIsUserLogin(false);
        }
    }, [whoAmI.data]);

    useEffect(() => {
        if (isAnyLoading) {
            setComponent(<LoadSpinner />);
        } else if (hasError) {
            setComponent(<p>Error: {errorMessage}</p>);
        } else if (isUserLogin) {
            setComponent(
                <div className={css.app + ' dark_theme'}>
                    <MainMenuBar />
                    <MainPanel />
                    <StatusBar />
                </div>
            );
        } else {
            setComponent(<LoginBox />);
        }
    }, [isAnyLoading, hasError, isUserLogin, errorMessage]);

    return (
        <Routes>
            <Route path='/reset/:encryptedEmail/:token' element={<ResetPasswordPage />} />
            <Route path='/reset' element={<RequestResetPassword />} />
            <Route path='/register' element={<RegisterNewUser />} />
            <Route path='/register_webauthn' element={<WebAuthnRegistrationComponent />} />
            <Route path='/authenticate_webauthn' element={<WebAuthnAuthenticationComponent />} />
            <Route path='/nickname_webauthn' element={<DeviceNicknameComponent />} />
            <Route path='*' element={component} />
        </Routes>
    );
};

export default Fence;
