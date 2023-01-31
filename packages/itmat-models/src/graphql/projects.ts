import gql from 'graphql-tag';
import { JOB_FRAGMENT } from './curation';
import { FIELD_FRAGMENT } from './fields';


export const GET_PROJECT = gql`
    query getProject($projectId: String!, $admin: Boolean!) {
        getProject(projectId: $projectId) {
            id
            studyId
            name
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
