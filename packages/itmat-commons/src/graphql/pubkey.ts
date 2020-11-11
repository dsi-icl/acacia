import gql from 'graphql-tag';

export const REGISTER_PUBKEY = gql`
    mutation registerPubkey($pubkey: String!, $signature: String!, $associatedUserId: String) {
        registerPubkey(pubkey: $pubkey, signature: $signature, associatedUserId: $associatedUserId) {
            id
            pubkey
            jwtSecret
            associatedUserId
        }
    }
`;

export const GET_PUBKEYS = gql`
    query getPubkeys($pubkeyId: String) {
        getPubkeys(pubkeyId: $pubkeyId) {
            id
            pubkey
            associatedUserId
            refreshCounter
            deleted
        }
    }
`;

export const LINK_USER_PUBKEY = gql`
    mutation linkUserPubkey(
        $pubkey: String!
        $signature: String!
        $associatedUserId: String!
        $pubkeyId: String!
    ) {
        linkUserPubkey(            
            pubkeyId: $pubkeyId
            pubkey: $pubkey
            associatedUserId: $associatedUserId
            signature: $signature            
            ) {
            sucessful
        }
    }
`;

export const ISSUE_ACCESS_TOKEN = gql`
    mutation issueAccessToken(
        $pubkey: String!
        $signature: String!
    ) {
        issueAccessToken(
            pubkey: $pubkey
            signature: $signature
            ) {
            accessToken
        }
    }
`;