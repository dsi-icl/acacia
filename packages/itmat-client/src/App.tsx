import * as React from 'react';
import { ApolloProvider, Query } from "react-apollo";
import { client } from './components/apolloClient';
import { LoginBox } from './components/login';
import { WHO_AM_I } from './graphql/user';
import * as css from './css/app.css';
import { BrowserRouter as Router } from 'react-router-dom';
import { RightPanel } from './components/scaffold/rightPanel';
import { LeftPanel } from './components/scaffold/leftPanel';
class App extends React.Component {
  public render() {
    return (
      <ApolloProvider client={client}>
          <div className={css.app}>
            <Query query={WHO_AM_I}>
              {({loading, error, data }) => {
                console.log('rendering', loading, error, data);
                if (loading) return <p>Loading...</p>;
                if (error) return <p>Error :( {error}</p>;
                if (data.whoAmI !== null && data.whoAmI !== undefined && data.whoAmI.username !== null) return <Router><><LeftPanel/><RightPanel/></></Router>;
                return <LoginBox/>;
              }}
            </Query>
          </div>
      </ApolloProvider>
    );
  }
}

export default App;
