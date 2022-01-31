import gql from 'graphql-tag';

export const GET_GRANTED_PERMISSIONS = gql`
    query getGrantedPermissions($studyId: String, $projectId: String) {
        getGrantedPermissions(studyId: $studyId, projectId: $projectId) {
            studies {
                studyId
                permissions
            }
            projects {
                projectId
                permissions
            }
        }
    }
`;

export const EDIT_ROLE = gql`
    mutation editRole(
        $roleId: String!,
        $name: String,
        $permissionChanges: StringArrayChangesInput,
        $userChanges: StringArrayChangesInput
    ) {
        editRole(roleId: $roleId, name: $name, permissionChanges: $permissionChanges, userChanges: $userChanges) {
            id
            name
            studyId
            projectId
            permissions
            users {
                id
                organisation
                firstname
                lastname
            }
        }
    }
`;

export const ADD_NEW_ROLE = gql`
    mutation addRoleToStudyOrProject(
        $studyId: String!
        $projectId: String,
        $roleName: String!
    ) {
        addRoleToStudyOrProject (
            studyId: $studyId,
            projectId: $projectId,
            roleName: $roleName,
        ) {
            id
            name
            permissions
            studyId
            projectId
            users {
                id
                firstname
                lastname
                organisation
            }
        }
    }
`;

export const REMOVE_ROLE = gql`
    mutation removeRole($roleId: String!) {
        removeRole(roleId: $roleId) {
            successful
        }
    }
`;
