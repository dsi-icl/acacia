import gql from 'graphql-tag';

export const field_fragment = gql`
    fragment ALL_FOR_FIELD on Field {
        id
        studyId
        fieldId
        database
        tableName
        tableId
        sequentialOrder
        questionNumber
        fieldName
        label
        labelDe
        labelNl
        labelIt
        labelEs
        labelPl
        labelF
        eligibleAnswer
        ineligibleAnswer
        validation
        dataType
        controlType
        systemGenerated
        valueList
        length
        displayFormat
        nullable
        required
        mandatory
        collectIf
        notMapped
        defaultValue
        regEx
        regExErrorMsg
        showOnIndexView
        comments
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
