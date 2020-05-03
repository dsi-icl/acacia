import { InMemoryCache } from 'apollo-cache-inmemory';
import { ApolloClient } from 'apollo-client';
import { from, split } from 'apollo-link';
import { onError } from 'apollo-link-error';
import { WebSocketLink } from 'apollo-link-ws';
import { createUploadLink } from 'apollo-upload-client';
import { getMainDefinition } from 'apollo-utilities';

const wsLink = new WebSocketLink({
    uri: process.env.REACT_APP_GRAPHQL_SERVICE?.replace('http', 'ws') ?? '/',
    options: {
        reconnect: true
    }
});

const uploadLink = createUploadLink({
    uri: process.env.REACT_APP_GRAPHQL_SERVICE,
    credentials: 'include'
});

const link = split(
    // split based on operation type
    ({ query }) => {
        const { kind, operation } = getMainDefinition(query) as any;
        return kind === 'OperationDefinition' && operation === 'subscription';
    },
    wsLink,
    uploadLink
);

const cache = new InMemoryCache({
    dataIdFromObject: (object) => `${object.__typename || 'undefined_typeName'}___${object.id || 'undefined_id'}`
});

export const client = new ApolloClient({
    link: from([
        onError(({ graphQLErrors, networkError }) => {
            if (graphQLErrors) {
                graphQLErrors.map((error) =>
                    // eslint:disable-next-line: no-console
                    console.error('[GraphQL error]', error)
                );
            }
            if (networkError) { console.error('[Network error]:', networkError); }
        }),
        link
    ]),
    cache
});
