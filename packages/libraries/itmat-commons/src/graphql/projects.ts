import { gql } from '@apollo/client';
import { JOB_FRAGMENT } from './curation';


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
                    realName
                    organisation
                    username
                }
            }
            iCanEdit
            fields
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
    ${JOB_FRAGMENT}
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
    mutation editProjectApprovedFields($projectId: String!, $fieldTreeId: String! $approvedFields: [String]!) {
        editProjectApprovedFields(projectId: $projectId, fieldTreeId: $fieldTreeId, approvedFields: $approvedFields) {
            id
            approvedFields
            fields
        }
    }
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
