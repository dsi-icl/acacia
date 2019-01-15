import gql from "graphql-tag";

export const CREATE_APPLICATION = gql`
    mutation CreateApplication($study: String!, $application: String!, $approvedFields: [String]){
        createApplication(study: $study, application: $application, approvedFields: $approvedFields) {
            id
            successful
        }
    }
`;

export const UPDATE_APPLICATION_LIST = gql`
    query updateApplication($name: String){
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