import gql from "graphql-tag";

export const GET_STUDIES_LIST = gql`
    {
        getStudies {
            id
            name
            iHaveAccess
            studyAndDataManagers
            applications {
                id
                name
                applicationAdmins
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

export const GET_STUDIES_APPLICATIONS_NAME = gql`
    query getStudiesApplicationsName($name: String){
        getStudies(name: $name) {
            id
            studyAndDataManagers
            applications {
                id
                name
                applicationAdmins
            }
        }
    }
`;

export const GET_STUDIES = gql`
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
`;

export const CREATE_STUDY = gql`
    mutation createStudy($name: String!, $isUkbiobank: Boolean!){
        createStudy(name: $name, isUkbiobank: $isUkbiobank) {
            id
            name
        }
    }
`;