import gql from "graphql-tag";

export const CREATE_APPLICATION = gql`
    mutation CreateApplication($study: String!, $application: String!, $approvedFields: [String]){
        createApplication(study: $study, application: $application, approvedFields: $approvedFields) {
            id
            applications {
                id
                name
            }
        }
    }
`;

export const DELETE_APPLICATION = gql`
    mutation deleteApplication($study: String!, $application: String!){
        deleteApplication(study: $study, application: $application) {
            id
            applications {
                id
                name
            }
        }
    }
`;

export const SUBSCRIPTION_NEW_APPLICATION = gql`
    subscription newApplicationCreated($name: String!) {
        newApplicationCreated(studyName: $name) {
            id
            name
        }
    }
`; 

export const GET_APPLICATION = gql`
    query getApplication($name: String){
        getStudies(name: $name) {
            id
            applications {
                id
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
            applicationAdmins
            applicationUsers
        }
    }
`;

export const ADD_USER_TO_APPLICATION = gql`
    mutation addUserToApplication($username: String!, $study: String!, $application: String!, $type: APPLICATION_USER_TYPE!) {
        addUserToApplication(username: $username, study: $study, application: $application, type: $type) {
            id
            applicationAdmins
            applicationUsers
        }
    }
`;


export const ADD_USER_TO_STUDY_MANAGERS = gql`
    mutation addUserToStudyManagers($username: String!, $study: String!) {
        addUserToStudyManagers(username: $username, study: $study) {
            id
            studyAndDataManagers
        }
    }
`;

export const REMOVE_USER_FROM_STUDY_MANAGERS = gql`
    mutation removeUserFromStudyManagers($username: String!, $study: String!) {
        removeUserFromStudyManagers(username: $username, study: $study) {
            id
            studyAndDataManagers
        }
    }
`;