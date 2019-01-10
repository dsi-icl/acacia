import gql from "graphql-tag";

export const GET_USERS_LIST = gql`
    {
        getUsers {
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
        $emailNotificationsActivated: Boolean!
        $email: String!
        $type: USERTYPE!
    ){
        createUser(user: {
            username: $username
            password: $password
            realName: $realName
            emailNotificationsActivated: $emailNotificationsActivated
            email: $email
            type: $type
        }) {
            successful
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
            successful
        }
    }
`;