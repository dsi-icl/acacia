import * as React from 'react';
import { ApolloProvider, } from 'react-apollo';
import { BrowserRouter as Router } from 'react-router-dom';
import { client } from './components/apolloClient';

const Providers: React.FunctionComponent = ({ children }) => (
    <ApolloProvider client={client}>
        <Router>
            {children}
        </Router>
    </ApolloProvider>
);

export default Providers;
