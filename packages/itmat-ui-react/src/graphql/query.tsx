import gql from 'graphql-tag';

export const GET_QUERY = gql`
    query getQueries($study: String, $application: String, $id: String) {
        getQueries(study: $study, application: $application, id: $id) {
            id
            queryString
            study
            application
            requester
            claimedBy
            lastClaimed
            status
            error
            cancelled
            cancelledTime
        }
    }
`;


export const CREATE_QUERY = gql`
    mutation createQuery($query: QueryObjInput!) {
        createQuery(query: $query) {
            id
            queryString
            study
            application
            requester
            claimedBy
            lastClaimed
            status
            error
            cancelled
            cancelledTime
        }
    }
`;

export const GET_QUERY_RESULT = gql`
    query getQueries($id: String) {
        getQueries(id: $id) {
            id
            queryResult
        }
    }
`;

