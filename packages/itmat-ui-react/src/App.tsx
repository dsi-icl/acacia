import * as React from 'react';
import { Query } from '@apollo/client/react/components';
import { Switch, Route } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import Providers from './Providers';
import { LoginBox } from './components/login/login';
import { MainMenuBar } from './components/scaffold/mainMenuBar';
import { MainPanel } from './components/scaffold/mainPanel';
import css from './components/scaffold/scaffold.module.css';
import { ResetPasswordPage } from './components/login/resetPasswordPage';
import { RequestResetPassword } from './components/login/requestResetPasswordPage';
import { RegisterNewUser } from './components/login/register';
import { WHO_AM_I, RECOVER_SESSION_EXPIRE_TIME } from 'itmat-commons';
import LoadSpinner from './components/reusable/loadSpinner';
import { StatusBar } from './components/scaffold/statusBar';

export const App: React.FunctionComponent = () => (
    <Providers>
        <Helmet>
            <title>{process.env.REACT_APP_NAME ?? 'Data Portal'}</title>
        </Helmet>
        <Switch>
            <Route path='/reset/:encryptedEmail/:token' component={ResetPasswordPage} />
            <Route path='/reset' component={RequestResetPassword} />
            <Route path='/register' component={RegisterNewUser} />
            <Route>
                <Query<any, any> query={WHO_AM_I}>
                    {({ loading, error, data }) => {
                        if (loading) {
                            return (
                                <LoadSpinner />
                            );
                        }
                        if (error) {
                            return (
                                <p>
                                    Error :(
                                    {' '}
                                    {error.message}
                                </p>
                            );
                        }
                        if (data.whoAmI !== null && data.whoAmI !== undefined && data.whoAmI.username !== null) { // if logged in return the app
                            return <div className={css.app + ' dark_theme'}>
                                <Query<any, any> query={RECOVER_SESSION_EXPIRE_TIME} pollInterval={30 * 60 * 1000 /* 30 minutes */}>
                                    { () => {
                                        return null;
                                    }}
                                </Query>
                                <MainMenuBar projects={data.whoAmI.access.projects} />
                                <MainPanel />
                                <StatusBar />
                            </div>;
                        }
                        return <LoginBox />;
                    }}
                </Query>
            </Route>
        </Switch>
    </Providers>
);

export default App;
