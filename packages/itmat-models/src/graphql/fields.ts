import gql from 'graphql-tag';

export const FIELD_FRAGMENT = gql`
    fragment ALL_FOR_FIELD on Field {
        id
        studyId
        fieldId
        fieldName
        tableName
        dataType
        dataVersion
        possibleValues {
            id
            code
            description
        }
        unit
        comments
        dateAdded
        dateDeleted
    }
`;

export const GET_STUDY_FIELDS = gql`
    query getStudyFields($studyId: String!, $projectId: String, $versionId: String) {
        getStudyFields(studyId: $studyId, projectId: $projectId, versionId: $versionId) {
            ...ALL_FOR_FIELD
        }
    }
    ${FIELD_FRAGMENT}
`;

export const CREATE_NEW_FIELD = gql`
    mutation createNewField($studyId: String!, $fieldInput: [FieldInput]!) {
        createNewField(studyId: $studyId, fieldInput: $fieldInput) {
            code
            description
        }
    }
`;

export const EDIT_FIELD = gql`
    mutation editField($studyId: String!, $fieldInput: FieldInput!) {
        editField(studyId: $studyId, fieldInput: $fieldInput) {
            ...ALL_FOR_FIELD
        }
    }
    ${FIELD_FRAGMENT}
`;

export const DELETE_FIELD = gql`
    mutation deleteField($studyId: String!, $fieldId: String!) {
        deleteField(studyId: $studyId, fieldId: $fieldId) {
            ...ALL_FOR_FIELD
        }
    }
    ${FIELD_FRAGMENT}
`;
