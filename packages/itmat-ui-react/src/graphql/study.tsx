import gql from "graphql-tag";

export const GET_STUDIES_LIST = gql`
    {
        getStudies {
            id
            name
            projects {
                id
                studyId
                name
            }
        }
    }
`;

export const DELETE_STUDY = gql`
    mutation deleteStudy($name: String!) {
        deleteStudy(name: $name) {
            id
            successful
        }
    }
`;

export const GET_STUDY = gql`
    query getStudy($studyId: String!) {
        getStudy(studyId: $studyId) {
            id
            name
            createdBy
            jobs {
                id
                studyId
                status
                requester
                receivedFiles
            }
            projects {
                id
                studyId
                name
            }
            fields {
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
            roles {
                id
                users {
                    id
                    username
                }
            }
        }
    }
`;

export const CREATE_STUDY = gql`
    mutation createStudy($name: String!, $isUkbiobank: Boolean!){
        createStudy(name: $name, isUkbiobank: $isUkbiobank) {
            id
            name
        }
    }
`;

export const CREATE_PROJECT = gql`
    mutation createProject($studyId: String!, $projectName: String!, $approvedFields: [String]) {
        createProject(studyId: $studyId, projectName: $projectName, approvedFields: $approvedFields) {
            id
            studyId
            name 
            approvedFields
        }
    }
`;

export const DELETE_PROJECT = gql`
    mutation deleteProject($projectId: String!) {
        deleteProject(projectId: $projectId) {
            id
        }
    }
`;