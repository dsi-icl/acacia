import gql from 'graphql-tag';
import { JOB_FRAGMENT } from './curation';
import { FIELD_FRAGMENT } from './fields';


export const GET_PROJECT = gql`
    query getProject($projectId: String!, $admin: Boolean!) {
        getProject(projectId: $projectId) {
            id
            studyId
            name
            approvedFields @include(if: $admin)
            approvedFiles @include(if: $admin)
            dataVersion {
                id
                version
                contentId
                tag
                updateDate
            }
            summary
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
    ${JOB_FRAGMENT}
    ${FIELD_FRAGMENT}
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
    ${FIELD_FRAGMENT}
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
