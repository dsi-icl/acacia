import { InMemoryCache } from '@apollo/client/cache';
import { ApolloClient, from, ApolloLink } from '@apollo/client';
import { onError } from '@apollo/client/link/error';
import { createUploadLink } from 'apollo-upload-client';

const uploadLink = createUploadLink({
    uri: `${window.location.origin}/graphql`,
    credentials: 'include'
}) as any as ApolloLink;

const cache = new InMemoryCache({
    dataIdFromObject: (object) => {
        switch (object.__typename) {
            case 'OrganisationMetadata':
                return `${object.siteIDMarker}`;
            default:
                return `${object.__typename || 'undefined_typeName'}___${object.id || 'undefined_id'}`;

        }
    }
});

export const client = new ApolloClient({
    link: from([
        onError(({ response, graphQLErrors, networkError }) => {
            if (graphQLErrors) {
                if ((response as any).errors[0].message === 'NOT_LOGGED_IN') {
                    window.location.reload();
                }
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
