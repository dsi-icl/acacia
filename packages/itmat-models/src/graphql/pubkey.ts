import gql from 'graphql-tag';

export const GET_PUBKEYS = gql`
    query getPubkeys($pubkeyId: String, $associatedUserId: String) {
        getPubkeys(pubkeyId: $pubkeyId, associatedUserId: $associatedUserId) {
            id
            pubkey
            associatedUserId
            jwtPubkey
            refreshCounter
            deleted
        }
    }
`;

export const REGISTER_PUBKEY = gql`
    mutation registerPubkey($pubkey: String!, $signature: String!, $associatedUserId: String) {
        registerPubkey(pubkey: $pubkey, signature: $signature, associatedUserId: $associatedUserId) {
            id
            pubkey
            jwtPubkey
            jwtSeckey
            associatedUserId
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
    mutation issueAccessToken($pubkey: String!, $signature: String!) {
        issueAccessToken(pubkey: $pubkey, signature: $signature) {
            accessToken
        }
    }
`;

export const KEYPAIRGEN_SIGNATURE = gql`
    mutation keyPairGenwSignature {
        keyPairGenwSignature {
            privateKey
            publicKey
            signature
        }        
    }
`;

export const RSA_SIGNER = gql`
    mutation rsaSigner($privateKey: String!, $message: String) {
        rsaSigner(privateKey: $privateKey, message: $message) {
            signature
        }
    }
`;
