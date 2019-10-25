import gql from 'graphql-tag';


export const user_fragment = gql`
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
${user_fragment}
`;

export const WHO_AM_I = gql`
    query {
        whoAmI {
            ...ALL
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
