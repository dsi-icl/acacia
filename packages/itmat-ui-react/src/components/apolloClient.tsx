import { InMemoryCache } from 'apollo-cache-inmemory';
import { ApolloClient } from 'apollo-client';
import { from } from 'apollo-link';
import { onError } from 'apollo-link-error';
import { createUploadLink } from 'apollo-upload-client';

const uploadLink = createUploadLink({
    uri: `${window.location.origin}/graphql`,
    credentials: 'include'
});

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
        uploadLink
    ]),
    cache
});
