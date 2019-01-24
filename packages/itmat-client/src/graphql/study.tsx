import gql from "graphql-tag";

export const GET_STUDIES_LIST = gql`
    {
        getStudies {
            id
            name
        }
    }
`;

export const GET_STUDIES = gql`
    query getStudies($name: String){
        getStudies(name: $name) {
            name
            studyAndDataManagers
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
            createdBy
            jobs {
                id
                requester
                jobType
                receivedFiles
                status
                cancelled
                cancelledTime
                data
            }
        }
    }
`;

export const CREATE_STUDY = gql`
    mutation createStudy($name: String!, $isUkbiobank: Boolean!){
        createStudy(name: $name, isUkbiobank: $isUkbiobank) {
            name
        }
    }
`;