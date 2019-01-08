import gql from "graphql-tag";

export const LOGIN = gql`
    mutation Login($username: String!, $password: String!) {
        login(username: $username, password: $password) {
            username
            type
            realName
            email
            emailNotificationsActivated
            createdBy
        }
    }
`;

export const LOGOUT = gql`
    mutation {
        logout{
            successful
            id
        }
    }
`;

export const WHO_AM_I = gql`
    {
        whoAmI {
            username
            type
            realName
            email
            emailNotificationsActivated
            createdBy
        }
    }
`;