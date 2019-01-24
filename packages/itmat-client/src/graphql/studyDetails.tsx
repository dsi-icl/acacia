import gql from "graphql-tag";

export const CREATE_APPLICATION = gql`
    mutation CreateApplication($study: String!, $application: String!, $approvedFields: [String]){
        createApplication(study: $study, application: $application, approvedFields: $approvedFields) {
            id
            successful
        }
    }
`;

export const GET_APPLICATION = gql`
    query getApplication($name: String){
        getStudies(name: $name) {
            applications {
                name
                pendingUserApprovals {
                    user
                    type
                }
                applicationAdmins
                applicationUsers
                approvedFields
            }
        }
    }
`;

export const DELETE_USER_FROM_APPLICATION = gql`
    mutation deleteUserFromApplication($username: String!, $study: String!, $application: String!) {
        deleteUserFromApplication(username: $username, study: $study, application: $application) {
            id
            successful
        }
    }
`;

export const ADD_USER_TO_APPLICATION = gql`
    mutation addUserToApplication($username: String!, $study: String!, $application: String!, $type: APPLICATION_USER_TYPE!) {
        addUserToApplication(username: $username, study: $study, application: $application, type: $type) {
            id
            successful
        }
    }
`;