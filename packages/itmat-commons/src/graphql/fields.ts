import gql from 'graphql-tag';

export const field_fragment = gql`
    fragment ALL_FOR_FIELD on Field {
        id
        studyId
        path
        fieldId
        fieldName
        valueType
        possibleValues
        unit
        itemType
        numOfTimePoints
        numOfMeasurements
        notes
        fieldTreeId
    }
`;

export const GET_STUDY_FIELDS = gql`
    query getStudyFields($fieldTreeId: String!, $studyId: String!) {
        getStudyFields(fieldTreeId: $fieldTreeId, studyId: $studyId) {
            ...ALL_FOR_FIELD
        }
    }
    ${field_fragment}
`;
