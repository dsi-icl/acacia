import { InMemoryCache } from '@apollo/client/cache';
import { ApolloClient, from, split, ApolloLink } from '@apollo/client';
import { onError } from '@apollo/client/link/error';
import { WebSocketLink } from '@apollo/client/link/ws';
import { createUploadLink } from 'apollo-upload-client';
import { getMainDefinition } from '@apollo/client/utilities';

// const wsClient = new SubscriptionClient(`${window.location.origin?.replace('http', 'ws')}/graphql`, {
//     reconnect: true
// });

// const wsLink = new WebSocketLink(wsClient);

// const uploadLink = createUploadLink({
//     uri: '/graphql',
//     credentials: 'include'
// });

const wsLink = new WebSocketLink({
    uri: 'ws://localhost:3003/graphql',
    options: {
        reconnect: true
    }
});

const uploadLink = createUploadLink({
    uri: 'http://localhost:3003/graphql',
    credentials: 'include'
}) as any as ApolloLink;

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
