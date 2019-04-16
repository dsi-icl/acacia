import * as React from 'react';
import { ApolloProvider, Query } from "react-apollo";
import { client } from './components/apolloClient';
import { LoginBox } from './components/login';
import { WHO_AM_I } from './graphql/user';
import * as css from './css/scaffold.module.css';
import { BrowserRouter as Router } from 'react-router-dom';
import { MainMenuBar } from './components/scaffold/mainMenuBar';
import { MainPanel } from './components/scaffold/mainPanel';
import { WarningTooNarrow } from './components/warningTooNarrow';

class App extends React.Component {
  public render() {
    return (
      <ApolloProvider client={client}>
            <Query query={WHO_AM_I}>
              {({loading, error, data }) => {
                if (loading) return <p>Loading...</p>;
                if (error) return <p>Error :( {error.message}</p>;
                if (data.whoAmI !== null && data.whoAmI !== undefined && data.whoAmI.username !== null) // if logged in return the app
                  return <div className={css.app}><Router><><WarningTooNarrow/>
                  <MainMenuBar shortcuts={data.whoAmI.shortcuts || []}/><MainPanel/></></Router></div>;
                return <LoginBox/>; // if not logged in return the login boxs
              }}
            </Query>
      </ApolloProvider>
    );
  }
}

export default App;
