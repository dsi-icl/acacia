import gql from 'graphql-tag';

export const GET_QUERY = gql`
    query getQueries($studyId: String, $projectId: String) {
        getQueries(studyId: $studyId, projectId: $projectId) {
            id
            queryString
            studyId
            projectId
            requester
            status
            error
            cancelled
            cancelledTime
            queryResult
            data_requested
            cohort
            new_fields
        }
    }
`;


export const CREATE_QUERY = gql`
    mutation createQuery($query: QueryObjInput!) {
        createQuery(query: $query) {
            id
            queryString
            studyId
            projectId
            requester
            status
            error
            cancelled
            cancelledTime
            queryResult
            data_requested
            cohort
            new_fields
        }
    }
`;

export const GET_QUERY_BY_ID = gql`
    query getQueryById($queryId: String!) {
        getQueryById(queryId: $queryId) {
            queryResult
        }
    }
`;
