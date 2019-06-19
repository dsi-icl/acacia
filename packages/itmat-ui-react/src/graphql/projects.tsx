import gql from "graphql-tag";


export const GET_PROJECT = gql`
    query getProject($projectId: String!, $admin: Boolean!) {
        getProject(projectId: $projectId) {
            id
            studyId
            name
            approvedFields
            jobs {
                id
                jobType
                requester
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
        }
    }
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
        }
    }
`; 