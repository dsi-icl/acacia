import { gql } from '@apollo/client';

export const GET_STUDY_FIELDS = gql`
    query getStudyFields($fieldTreeId: String!, $studyId: String!) {
        getStudyFields(fieldTreeId: $fieldTreeId, studyId: $studyId) {
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
    }
`;
