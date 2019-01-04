import * as React from 'react';
import './App.css';
import { ApolloProvider, Query } from "react-apollo";
import { client } from './components/apolloClient';
import gql from "graphql-tag";
import { LoginBox } from './components/login';

class App extends React.Component {
  public render() {
    return (
      <ApolloProvider client={client}>
        <Query query={gql`
          {
            whoAmI {
              username
              type
              realName
              email
              emailNotificationsActivated
              createdBy
            }
          }
          `}
        >
          {({loading, error, data, refetch }) => {
            if (loading) return <p>Loading...</p>;
            if (error) return <p>Error :( {error}</p>;
            if (data.username === undefined) return <p><LoginBox refetch={refetch}/></p>;
            return <p> You are {data.username}</p>;
          }}
        </Query>
        <div className="App">
        HELLO
        </div>
      </ApolloProvider>
    );
  }
}

export default App;
