import gql from 'graphql-tag';

export const user_fragment = gql`
    fragment ALL_FOR_USER on User {
        id
        username
        otpSecret
        type
        realName
        email
        createdBy
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
        }
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
