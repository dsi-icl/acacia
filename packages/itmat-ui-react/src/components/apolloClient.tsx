import { InMemoryCache } from 'apollo-cache-inmemory';
import { ApolloClient } from 'apollo-client';
import { from, split } from 'apollo-link';
import { onError } from 'apollo-link-error';
import { WebSocketLink } from 'apollo-link-ws';
import { SubscriptionClient } from 'subscriptions-transport-ws';
import { createUploadLink } from 'apollo-upload-client';
import { getMainDefinition } from 'apollo-utilities';

const wsClient = new SubscriptionClient(`${window.location.origin?.replace('http', 'ws')}/graphql`, {
    reconnect: true
});

const wsLink = new WebSocketLink(wsClient);

const uploadLink = createUploadLink({
    uri: '/graphql',
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
                    console.error('[GraphQL error]', error.message ? error.message : error)
                );
            }
            if (networkError) {
                console.error('[Network error]:', networkError.message ? networkError.message : networkError);
            }
        }),
        link
    ]),
    cache
});
