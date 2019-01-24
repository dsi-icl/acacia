import gql from "graphql-tag";

export const GET_USERS_LIST = gql`
    {
        getUsers {
            id
            username
            type
            realName
            email
        }
    }
`;

export const GET_SPECIFIC_USER = gql`
    query getSpecificUser($username: String){
        getUsers(username: $username) {
            id
            username
            type
            realName
            description
            email
            emailNotificationsActivated
            createdBy
        }
    }
`;

export const CREATE_USER = gql`
    mutation CreateUser(
        $username: String!
        $password: String!
        $realName: String!
        $description: String!
        $emailNotificationsActivated: Boolean!
        $email: String!
        $type: USERTYPE!
    ){
        createUser(user: {
            username: $username
            password: $password
            realName: $realName
            description: $description
            emailNotificationsActivated: $emailNotificationsActivated
            email: $email
            type: $type
        }) {
            id
            username
            type
            realName
            description
            email
            emailNotificationsActivated
            createdBy
        }
    }
`;

export const EDIT_USER = gql`
    mutation EditUser(
        $username: String!
        $type: USERTYPE
        $realName: String
        $email: String
        $emailNotificationsActivated: Boolean
        $password: String
    ) {
        editUser(user: {
            username: $username
            password: $password
            realName: $realName
            emailNotificationsActivated: $emailNotificationsActivated
            email: $email
            type: $type
        }) {
            id
            username
            type
            realName
            description
            email
            emailNotificationsActivated
        }
    }
`;

export const DELETE_USER = gql`
    mutation DeleteUser($username: String!) {
        deleteUser(username: $username) {
            id
            successful
        }
    }
`;