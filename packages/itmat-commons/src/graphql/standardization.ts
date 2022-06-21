import gql from 'graphql-tag';

export const GET_STANDARDIZATION = gql`
    query getStandardization($studyId: String, $projectId: String, $type: String) {
        getStandardization(studyId: $studyId, projectId: $projectId, type: $type) {
            id
            studyId
            type
            field
            path
            joinByKeys
            stdRules {
                id
                entry
                source
                parameter
                filters
            }
            deleted
        }
    }
`;

export const CREATE_STANDARDIZATION = gql`
    mutation createStandardization($studyId: String!, $standardization: StandardizationInput!) {
        createStandardization(studyId: $studyId, standardization: $standardization) {
            id
            studyId
            type
            field
            path
            joinByKeys
            stdRules {
                id
                entry
                source
                parameter
                filters
            }
            deleted
        }
    }
`;

export const DELETE_STANDARDIZATION = gql`
    mutation deleteStandardization($studyId: String!, $stdId: String!) {
        deleteStandardization(studyId: $studyId, stdId: $stdId) {
            id
            successful
        }
    }
`;
