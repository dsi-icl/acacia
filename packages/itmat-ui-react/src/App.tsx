import * as React from 'react';
import { ApolloProvider, Query } from 'react-apollo';
import { BrowserRouter as Router } from 'react-router-dom';
import { client } from './components/apolloClient';
import { LoginBox } from './components/login/login';
import { Spinner } from './components/reusable/spinner';
import { MainMenuBar } from './components/scaffold/mainMenuBar';
import { MainPanel } from './components/scaffold/mainPanel';
import * as css from './components/scaffold/scaffold.module.css';
import { StatusBar } from './components/scaffold/statusBar';
import { WHO_AM_I } from './graphql/user';

class App extends React.Component {
    public render() {
        return (
            <ApolloProvider client={client}>
                <Query query={WHO_AM_I}>
                    {({ loading, error, data }) => {
                        if (loading) { return <div style={{ width: '100%', height: '100%', textAlign: 'center', paddingTop: '20%' }}><Spinner /></div>; }
                        if (error) { return <p>Error :( {error.message}</p>; }
                        if (data.whoAmI !== null && data.whoAmI !== undefined && data.whoAmI.username !== null) { // if logged in return the app
                            return <div className={css.app}>
                                <Router>
                                    <>
                                        <MainMenuBar projects={data.whoAmI.access.projects} />
                                        <MainPanel />
                                        <StatusBar />
                                    </>
                                </Router>
                            </div>;
                        }
                        return <LoginBox />; // if not logged in return the login boxs
                    }}
                </Query>
            </ApolloProvider>
        );
    }
}

export default App;
