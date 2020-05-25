import gql from 'graphql-tag';
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
            createdAt
            expiredAt
            locked
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
        $createdAt: Float!
        $expiredAt: Float!
        $locked: Boolean!
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
            createdAt: $createdAt
            expiredAt: $expiredAt
            locked: $locked
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
        $expiredAt: Float
        $locked: Boolean
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
            expiredAt: $expiredAt
            locked: $locked
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
