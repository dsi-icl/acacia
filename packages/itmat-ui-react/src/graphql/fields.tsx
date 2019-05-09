import gql from "graphql-tag";

export const GET_AVAILABLE_FIELDS = gql`
query getAvailableFields($study: String!, $application: String){
    getAvailableFields(study: $study, application: $application) {
        id
        study
        Path
        Category
        FieldID
        Field
        Participants
        Items
        Stability
        ValueType
        Units
        ItemType
        Strata
        Sexed
        Instances
        Array
        Coding
        Notes
        Link
    }
}
`;