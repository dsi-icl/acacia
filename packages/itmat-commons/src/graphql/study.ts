import gql from 'graphql-tag';
import { job_fragment } from './curation';

export const DELETE_STUDY = gql`
    mutation deleteStudy($studyId: String!) {
        deleteStudy(studyId: $studyId) {
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
            description
            jobs {
                ...ALL_FOR_JOB
            }
            projects {
                id
                studyId
                name
            }
            roles {
                id
                name
                permissions
                projectId
                studyId
                users {
                    id
                    firstname
                    lastname
                    organisation
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
                uploadTime
                uploadedBy
                hash
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
                contentId
                fieldTrees
            }
        }
    }
    ${job_fragment}
`;

export const CREATE_STUDY = gql`
    mutation createStudy($name: String!, $description: String){
        createStudy(name: $name, description: $description) {
            id
            name
            description
        }
    }
`;

export const EDIT_STUDY = gql`
    mutation editStudy($studyId: String!, $description: String){
        editStudy(studyId: $studyId, description: $description) {
            id
            name
            description
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
            successful
        }
    }
`;

export const SET_DATAVERSION_AS_CURRENT = gql`
    mutation setDataversionAsCurrent($studyId: String!, $dataVersionId: String!) {
        setDataversionAsCurrent(studyId: $studyId, dataVersionId: $dataVersionId) {
            id
            currentDataVersion
            dataVersions {
                id
                version
                tag
                uploadDate
                jobId
                extractedFrom
                contentId
                fileSize
                fieldTrees
            }
        }
    }
`;
