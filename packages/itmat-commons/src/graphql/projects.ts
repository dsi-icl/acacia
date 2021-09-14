import gql from 'graphql-tag';
import { job_fragment } from './curation';
import { field_fragment } from './fields';


export const GET_PROJECT = gql`
    query getProject($projectId: String!, $admin: Boolean!) {
        getProject(projectId: $projectId) {
            id
            studyId
            name
            approvedFields @include(if: $admin)
            approvedFiles @include(if: $admin)
            jobs {
                ...ALL_FOR_JOB
            }
            roles @include(if: $admin) {
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
            iCanEdit
            fields {
                ...ALL_FOR_FIELD
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
            }
        }
    }
    ${job_fragment}
    ${field_fragment}
`;

export const GET_PROJECT_PATIENT_MAPPING = gql`
    query getProject($projectId: String!) {
        getProject(projectId: $projectId) {
            id
            patientMapping
        }
    }
`;

export const EDIT_PROJECT_APPROVED_FIELDS = gql`
    mutation editProjectApprovedFields($projectId: String!, $approvedFields: [String]!) {
        editProjectApprovedFields(projectId: $projectId, approvedFields: $approvedFields) {
            id
            approvedFields
            fields {
                ...ALL_FOR_FIELD
            }
        }
    }
    ${field_fragment}
`;

export const EDIT_PROJECT_APPROVED_FILES = gql`
    mutation editProjectApprovedFiles($projectId: String!, $approvedFiles: [String]!) {
        editProjectApprovedFiles(projectId: $projectId, approvedFiles: $approvedFiles) {
            id
            approvedFiles
            files {
                id
                fileName
                studyId
                projectId
                fileSize
                description
                uploadedBy
            }
        }
    }
`;
