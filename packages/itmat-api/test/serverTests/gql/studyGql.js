const { print } = require('graphql');
const gql = require('graphql-tag');

const GET_STUDIES_LIST = print(gql`
    query getStudies($name: String){
        getStudies(name: $name) {
            id
            name
            isUkbiobank
            studyAndDataManagers
            applications {
                id
                name
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
`);

const CREATE_STUDY = print(gql`
    mutation createStudy($name: String!, $isUkbiobank: Boolean!){
        createStudy(name: $name, isUkbiobank: $isUkbiobank) {
            id
            name
        }
    }
`);

const CREATE_APPLICATION = print(gql`
    mutation CreateApplication($study: String!, $application: String!, $approvedFields: [String]){
        createApplication(study: $study, application: $application, approvedFields: $approvedFields) {
            id
            applications {
                id
                name
            }
        }
    }
`);

const GET_APPLICATION = print(gql`
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
`);

module.exports = { GET_APPLICATION, GET_STUDIES_LIST, CREATE_APPLICATION, CREATE_STUDY };