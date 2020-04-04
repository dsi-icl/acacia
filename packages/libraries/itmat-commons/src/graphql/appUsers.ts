import { gql } from '@apollo/client';
import { user_fragment } from './user';

export const GET_USERS = gql`
    query getUsers($fetchDetailsAdminOnly: Boolean!, $fetchAccessPrivileges: Boolean!, $userId: String) {
        getUsers (userId: $userId) {
            id
            username @include (if: $fetchDetailsAdminOnly)
            type
            realName
            email @include (if: $fetchDetailsAdminOnly)
            createdBy
            organisation
            description @include (if: $fetchDetailsAdminOnly)
            access  @include (if: $fetchAccessPrivileges) {
                id
                projects {
                    id
                    name
                    studyId
                }
                studies {
                    id
                    name
                }
            }
        }
    }
`;

export const CREATE_USER = gql`
    mutation CreateUser(
        $username: String!
        $password: String!
        $realName: String!
        $description: String!
        $organisation: String!
        $emailNotificationsActivated: Boolean!
        $email: String!
        $type: USERTYPE!
    ){
        createUser(user: {
            username: $username
            password: $password
            realName: $realName
            description: $description
            organisation: $organisation
            emailNotificationsActivated: $emailNotificationsActivated
            email: $email
            type: $type
        }) {
            ...ALL_FOR_USER
        }
    }
    ${user_fragment}
`;

export const EDIT_USER = gql`
    mutation EditUser(
        $id: String!
        $username: String
        $type: USERTYPE
        $realName: String
        $email: String
        $emailNotificationsActivated: Boolean
        $password: String
        $description: String
        $organisation: String
    ) {
        editUser(user: {
            id: $id
            username: $username
            password: $password
            realName: $realName
            emailNotificationsActivated: $emailNotificationsActivated
            email: $email
            description: $description
            organisation: $organisation
            type: $type
        }) {
            ...ALL_FOR_USER
        }
    }
    ${user_fragment}
`;

export const DELETE_USER = gql`
    mutation DeleteUser($userId: String!) {
        deleteUser(userId: $userId) {
            id
            successful
        }
    }
`;