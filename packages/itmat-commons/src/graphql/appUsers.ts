import gql from 'graphql-tag';
import { USER_FRAGMENT } from './user';

export const GET_USERS = gql`
    query getUsers($fetchDetailsAdminOnly: Boolean!, $fetchAccessPrivileges: Boolean!, $userId: String) {
        getUsers (userId: $userId) {
            id
            username @include (if: $fetchDetailsAdminOnly)
            type
            firstname
            lastname
            email @include (if: $fetchDetailsAdminOnly)
            emailNotificationsActivated @include (if: $fetchDetailsAdminOnly)
            organisation
            createdAt @include (if: $fetchDetailsAdminOnly)
            expiredAt @include (if: $fetchDetailsAdminOnly)
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

export const EDIT_USER = gql`
    mutation EditUser(
        $id: String!
        $username: String
        $type: USERTYPE
        $firstname: String
        $lastname: String
        $email: String
        $emailNotificationsActivated: Boolean
        $password: String
        $description: String
        $organisation: String
        $expiredAt: Float
    ) {
        editUser(user: {
            id: $id
            username: $username
            password: $password
            firstname: $firstname
            lastname: $lastname
            emailNotificationsActivated: $emailNotificationsActivated
            email: $email
            description: $description
            organisation: $organisation
            type: $type
            expiredAt: $expiredAt
        }) {
            ...ALL_FOR_USER
        }
    }
    ${USER_FRAGMENT}
`;

export const DELETE_USER = gql`
    mutation DeleteUser($userId: String!) {
        deleteUser(userId: $userId) {
            id
            successful
        }
    }
`;
