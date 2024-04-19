import { InMemoryCache } from '@apollo/client/cache';
import { ApolloClient, from, ApolloLink } from '@apollo/client';
import { onError } from '@apollo/client/link/error';
import createUploadLink from 'apollo-upload-client/createUploadLink.mjs';
import axios from 'axios';

const customFetch = (uri, options): any => {
    options.url = uri;
    options.data = options.body;
    if (options.body instanceof FormData) {
        try {
            const currentOperation = JSON.parse((options.body as FormData).get('operations') as string);
            if (currentOperation.operationName === 'uploadFile') {
                const description = JSON.parse(currentOperation.variables.description);
                options.onUploadProgress = (progressEvent) => {
                    (window as any).onUploadProgressHackMap?.[`UP_${description.participantId}_${description.deviceId}_${description.startDate}_${description.endDate}`]?.(progressEvent);
                };
                options.onDownloadProgress = (progressEvent) => {
                    (window as any).onUploadProgressHackMap?.[`DOWN_${description.participantId}_${description.deviceId}_${description.startDate}_${description.endDate}`]?.(progressEvent);
                };
            }
        }
        catch (__unused__exception) {
            // Do nothing
        }
    }
    // return fetch(uri, options);
    return axios(options).then(response => ({
        headers: response.headers,
        ok: true,
        redirected: false,
        status: response.status,
        statusText: response.statusText,
        trailer: Promise.resolve(response.headers),
        type: response.headers?.['Content-Type'],
        body: response.data,
        url: uri,
        text: async () => {
            return Promise.resolve(JSON.stringify(response.data));
        }
    }));
};

const uploadLink = createUploadLink({
    uri: `${window.location.origin}/graphql`,
    credentials: 'include',
    fetch: customFetch
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
