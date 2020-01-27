import gql from 'graphql-tag';


export const USER_FRAGMENT = gql`
    fragment ALL on User {
        id
        username
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
mutation login($username: String!, $password: String!) {
  login(username: $username, password: $password) {
      ...ALL
  }
}
${USER_FRAGMENT}
`;

export const WHO_AM_I = gql`
    query {
        whoAmI {
            ...ALL
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
