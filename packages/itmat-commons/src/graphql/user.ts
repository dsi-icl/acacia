import gql from 'graphql-tag';

export const user_fragment = gql`
    fragment ALL_FOR_USER on User {
        id
        username
        otpSecret
        type
        realName
        email
        organisation
        description
        access {
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
        },
        createdAt,
        expiredAt
    }
`;

export const LOGIN = gql`
mutation login($username: String!, $password: String!, $totp: String!) {
  login(username: $username, password: $password, totp: $totp) {
      ...ALL_FOR_USER
  }
}
${user_fragment}
`;

export const WHO_AM_I = gql`
    query {
        whoAmI {
            ...ALL_FOR_USER
        }
    }
    ${user_fragment}
`;

export const LOGOUT = gql`
    mutation {
        logout{
            successful
            id
        }
    }
`;

export const REQUEST_USERNAME_OR_RESET_PASSWORD = gql`
    mutation requestUsernameOrResetPassword(
        $forgotUsername: Boolean!,
        $forgotPassword: Boolean!,
        $email: String,
        $username: String
    ) {
        requestUsernameOrResetPassword(
            forgotUsername: $forgotUsername,
            forgotPassword: $forgotPassword,
            email: $email,
            username: $username
        ) {
            successful
        }
    }
`;

export const RESET_PASSWORD = gql`
    mutation resetPassword(
        $encryptedEmail: String!,
        $token: String!,
        $newPassword: String!
    ) {
        resetPassword(
            encryptedEmail: $encryptedEmail,
            token: $token,
            newPassword: $newPassword
        ) {
            successful
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
            successful
        }
    }
`;
