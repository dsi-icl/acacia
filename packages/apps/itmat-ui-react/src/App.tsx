import * as React from 'react';
import { Query } from '@apollo/react-components';
import { WHO_AM_I } from '@itmat/commons';
import Providers from './Providers';
import { LoginBox } from './components/login/login';
import { Spinner } from './components/reusable/icons/spinner';
import { MainMenuBar } from './components/scaffold/mainMenuBar';
import { MainPanel } from './components/scaffold/mainPanel';
import css from './components/scaffold/scaffold.module.css';

export const App: React.FC = () => (
    <Providers>
        <Query<any, any> query={WHO_AM_I}>
            {({ loading, error, data }) => {
                if (loading) {
                    return (
                        <div style={{
                            width: '100%', height: '100%', textAlign: 'center', paddingTop: '20%',
                        }}
                        >
                            <Spinner />
                        </div>
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
                    return (
                        <div className={css.app}>
                            <MainMenuBar projects={data.whoAmI.access.projects} />
                            <MainPanel />
                        </div>
                    );
                }
                return <LoginBox />; // if not logged in return the login boxs
            }}
        </Query>
    </Providers>
);

export default App;
