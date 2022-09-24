import { FunctionComponent, PropsWithChildren } from 'react';
import { ApolloProvider } from '@apollo/client';
import { BrowserRouter as Router } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { client } from './components/apolloClient';

const Providers: FunctionComponent<PropsWithChildren<unknown>> = ({ children }) => (
    <ApolloProvider client={client}>
        <HelmetProvider>
            <Router basename={process.env.NX_REACT_APP_BASEHREF}>
                {children}
            </Router>
        </HelmetProvider>
    </ApolloProvider>
);

export default Providers;
