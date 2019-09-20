const { print } = require('graphql');
const gql = require('graphql-tag');

const GET_USERS_LIST = print(gql`
    {
        getUsers {
            id
            username
            type
            realName
            email
        }
    }
`);

const GET_USERS_LIST_ONLY_USERNAME = print(gql`
    {
        getUsers {
            id
            username
        }
    }
`);

const GET_SPECIFIC_USER = print(gql`
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
`);

const CREATE_USER = print(gql`
    mutation createUser(
        $username: String!
        $password: String!
        $realName: String!
        $organisation: String!
        $description: String!
        $emailNotificationsActivated: Boolean!
        $email: String!
        $type: USERTYPE!
    ){
        createUser(user: {
            username: $username
            password: $password
            realName: $realName
            organisation: $organisation
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
`);

const EDIT_USER = print(gql`
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
`);

const DELETE_USER = print(gql`
    mutation DeleteUser($userId: String!) {
        deleteUser(userId: $userId) {
            id
            successful
        }
    }
`);

module.exports = { DELETE_USER, EDIT_USER, GET_SPECIFIC_USER, GET_USERS_LIST, GET_USERS_LIST_ONLY_USERNAME, CREATE_USER }