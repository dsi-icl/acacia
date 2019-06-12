import gql from "graphql-tag";

export const GET_AVAILABLE_FIELDS = gql`
query getAvailableFields($studyId: String!, $projectId: String){
    getAvailableFields(studyId: $studyId, projectId: $projectId) {
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
    }
}
`;