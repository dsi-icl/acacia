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

const ADD_USER_TO_APPLICATION = print(gql`
    mutation addUserToApplication($username: String!, $study: String!, $application: String!, $type: APPLICATION_USER_TYPE!) {
        addUserToApplication(username: $username, study: $study, application: $application, type: $type) {
            id
            applicationAdmins
            applicationUsers
        }
    }
`);

const DELETE_USER_FROM_APPLICATION = print(gql`
    mutation deleteUserFromApplication($username: String!, $study: String!, $application: String!) {
        deleteUserFromApplication(username: $username, study: $study, application: $application) {
            id
            applicationAdmins
            applicationUsers
        }
    }
`);

const ADD_USER_TO_STUDY_MANAGERS = print(gql`
    mutation addUserToStudyManagers($username: String!, $study: String!) {
        addUserToStudyManagers(username: $username, study: $study) {
            id
            studyAndDataManagers
        }
    }
`);

const REMOVE_USER_FROM_STUDY_MANAGERS = print(gql`
    mutation removeUserFromStudyManagers($username: String!, $study: String!) {
        removeUserFromStudyManagers(username: $username, study: $study) {
            id
            studyAndDataManagers
        }
    }
`);

module.exports = { ADD_USER_TO_APPLICATION, GET_APPLICATION, GET_STUDIES_LIST, CREATE_APPLICATION, CREATE_STUDY, DELETE_USER_FROM_APPLICATION, ADD_USER_TO_STUDY_MANAGERS, REMOVE_USER_FROM_STUDY_MANAGERS };