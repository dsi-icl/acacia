import gql from 'graphql-tag';

export const USER_FRAGMENT = gql`
    fragment ALL_FOR_USER on User {
        id
        username
        type
        firstname
        lastname
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
                type
            }
        },
        createdAt,
        expiredAt
    }
`;

export const LOGIN = gql`
mutation login($username: String!, $password: String!, $totp: String!, $requestexpirydate: Boolean) {
  login(username: $username, password: $password, totp: $totp, requestexpirydate: $requestexpirydate) {
      ...ALL_FOR_USER
  }
}
${USER_FRAGMENT}
`;

export const WHO_AM_I = gql`
    query {
        whoAmI {
            ...ALL_FOR_USER
        }
    }
    ${USER_FRAGMENT}
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

export const VALIDATE_RESET_PASSWORD = gql`
    query validateResetPassword(
        $encryptedEmail: String!,
        $token: String!
    ) {
        validateResetPassword(
            encryptedEmail: $encryptedEmail,
            token: $token
        ) {
            successful
        }
    }
`;

export const CREATE_USER = gql`
    mutation CreateUser(
        $username: String!
        $password: String!
        $firstname: String!
        $lastname: String!
        $description: String
        $organisation: String!
        $emailNotificationsActivated: Boolean
        $email: String!
        $type: USERTYPE
    ){
        createUser(user: {
            username: $username
            password: $password            
            firstname: $firstname
            lastname: $lastname
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

export const RECOVER_SESSION_EXPIRE_TIME = gql`
    query recoverSessionExpireTime {
        recoverSessionExpireTime {
            successful
        }
    }
`;

export const REQUEST_EXPIRY_DATE = gql`
    mutation requestExpiryDate(
        $username: String,
        $email: String        
    ) {
        requestExpiryDate(
            username: $username,
            email: $email
        ) {
            successful
        }
    }
`;
