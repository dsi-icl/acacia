import { FunctionComponent, PropsWithChildren } from 'react';
import { ApolloProvider } from '@apollo/client';
import { BrowserRouter as Router } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { client } from './components/apolloClient';
import { AuthProvider } from './utils/dmpWebauthn/webauthn.context';

const Providers: FunctionComponent<PropsWithChildren<unknown>> = ({ children }) => (
    <ApolloProvider client={client}>
        <HelmetProvider>
            <Router basename={process.env.NX_REACT_APP_BASEHREF}>
                <AuthProvider>
                    {children}
                </AuthProvider>
            </Router>
        </HelmetProvider>
    </ApolloProvider>
);

export default Providers;
