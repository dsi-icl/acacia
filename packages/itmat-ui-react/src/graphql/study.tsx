import gql from "graphql-tag";
import { job_fragment } from "./curation";

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
                ...ALL
            }
            projects {
                id
                studyId
                name
            }
            roles {
                id
                users {
                    id
                    username
                }
            }
            files {
                id
                fileName
                studyId
                projectId
                fileSize
                description
                uploadedBy
            }
            numOfSubjects
            currentDataVersion
            dataVersions {
                id
                version
                tag
                uploadDate
                jobId
                extractedFrom
                fileSize
                fieldTrees
            }
        }
    }
    ${job_fragment}
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
