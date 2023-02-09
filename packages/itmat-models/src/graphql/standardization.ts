import gql from 'graphql-tag';

export const GET_STANDARDIZATION = gql`
    query getStandardization($studyId: String, $projectId: String, $type: String, $versionId: String,) {
        getStandardization(studyId: $studyId, projectId: $projectId, type: $type, versionId: $versionId) {
            id
            studyId
            type
            field
            path
            joinByKeys
            uploadedAt
            stdRules {
                id
                entry
                source
                parameter
                filters
            }
            dataVersion
            metadata
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
            uploadedAt
            stdRules {
                id
                entry
                source
                parameter
                filters
            }
            metadata
            deleted
        }
    }
`;

export const DELETE_STANDARDIZATION = gql`
    mutation deleteStandardization($studyId: String!, $field: [String]!, $type: String!) {
        deleteStandardization(studyId: $studyId, field: $field, type: $type) {
            id
            successful
            code
            description
        }
    }
`;
