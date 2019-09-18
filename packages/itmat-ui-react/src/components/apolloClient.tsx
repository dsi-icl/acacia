import { ApolloClient } from 'apollo-client';
import { InMemoryCache } from 'apollo-cache-inmemory';
import { onError } from 'apollo-link-error';
import { createUploadLink } from 'apollo-upload-client';
import { from, split } from 'apollo-link';
import { WebSocketLink } from 'apollo-link-ws';
import { getMainDefinition } from 'apollo-utilities';

const wsLink = new WebSocketLink({
  uri: `ws://localhost:3003/graphql`,
  options: {
    reconnect: true
  }
});

const uploadLink = createUploadLink({
  uri: 'http://localhost:3003/graphql',
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
  dataIdFromObject: object => `${object.__typename || 'undefined_typeName'}___${object.id || 'undefined_id'}`
});

export const client = new ApolloClient({
  link: from([
    onError(({ graphQLErrors, networkError }) => {
      if (graphQLErrors)
        graphQLErrors.map(({ message, locations, path }) =>
          console.log(
            `[GraphQL error]: Message: ${message}, Location: ${locations}, Path: ${path}`,
          ),
        );
      if (networkError) console.log(`[Network error]: ${networkError}`);
    }),
    link
  ]),
  cache
});