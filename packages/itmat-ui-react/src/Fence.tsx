import { FunctionComponent } from 'react';
import { Query } from '@apollo/client/react/components';
import { Routes, Route } from 'react-router-dom';
import { LoginBox } from './components/login/login';
import { MainMenuBar } from './components/scaffold/mainMenuBar';
import { MainPanel } from './components/scaffold/mainPanel';
import css from './components/scaffold/scaffold.module.css';
import { ResetPasswordPage } from './components/login/resetPasswordPage';
import { RequestResetPassword } from './components/login/requestResetPasswordPage';
import { RegisterNewUser } from './components/login/register';
import { WHO_AM_I, RECOVER_SESSION_EXPIRE_TIME } from '@itmat-broker/itmat-models';
import LoadSpinner from './components/reusable/loadSpinner';
import { StatusBar } from './components/scaffold/statusBar';
import { useQuery } from '@apollo/client/react/hooks';

export const Fence: FunctionComponent = () => {

    const { loading, error, data } = useQuery(WHO_AM_I);
    let component: JSX.Element | null = null;
    if (loading)
        component = <LoadSpinner />;
    else if (error)
        component = <p>
            Error
            {' '}
            {error.message}
        </p>;
    else if (data.whoAmI !== null && data.whoAmI !== undefined && data.whoAmI.username !== null) {
        component = <div className={css.app + ' dark_theme'}>
            <Query<any, any> query={RECOVER_SESSION_EXPIRE_TIME} pollInterval={30 * 60 * 1000 /* 30 minutes */}>
                {() => {
                    return null;
                }}
            </Query>
            <MainMenuBar projects={data.whoAmI.access.projects} />
            <MainPanel />
            <StatusBar />
        </div>;
    } else
        component = <LoginBox />;
    return <Routes>
        <Route path='/reset/:encryptedEmail/:token' element={<ResetPasswordPage />} />
        <Route path='/reset' element={<RequestResetPassword />} />
        <Route path='/register' element={<RegisterNewUser />} />
        <Route path='*' element={component} />
    </Routes>;
};

export default Fence;
