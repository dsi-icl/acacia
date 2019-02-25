const { print } = require('graphql');
const gql = require('graphql-tag');

const GET_USERS_LIST = gql`
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

const GET_USERS_LIST_ONLY_USERNAME = gql`
    {
        getUsers {
            id
            username
        }
    }
`;

const GET_SPECIFIC_USER = gql`
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

const CREATE_USER = gql`
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

const EDIT_USER = gql`
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

const DELETE_USER = gql`
    mutation DeleteUser($username: String!) {
        deleteUser(username: $username) {
            id
            successful
        }
    }
`;

module.exports = { DELETE_USER, EDIT_USER, GET_SPECIFIC_USER, GET_USERS_LIST, GET_USERS_LIST_ONLY_USERNAME, CREATE_USER }