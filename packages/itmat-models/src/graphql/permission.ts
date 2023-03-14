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
        $description: String,
        $permissionChanges: JSON,
        $userChanges: StringArrayChangesInput
    ) {
        editRole(roleId: $roleId, name: $name, description: $description, permissionChanges: $permissionChanges, userChanges: $userChanges) {
            id
            name
            studyId
            projectId
            description
            permissions
            users {
                id
                organisation
                firstname
                lastname
            }
            description
        }
    }
`;

export const ADD_NEW_ROLE = gql`
    mutation addRole(
        $studyId: String!
        $projectId: String,
        $roleName: String!
    ) {
        addRole (
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
