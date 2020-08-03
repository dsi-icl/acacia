import * as React from 'react';
import { ApolloProvider, } from '@apollo/client';
import { BrowserRouter as Router } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { client } from './components/apolloClient';

const Providers: React.FunctionComponent = ({ children }) => (
    <ApolloProvider client={client}>
        <HelmetProvider>
            <Router>
                {children}
            </Router>
        </HelmetProvider>
    </ApolloProvider>
);

export default Providers;
