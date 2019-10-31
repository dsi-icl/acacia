const LOGINSTRING = `mutation login($username: String!, $password: String!) {
    login(username: $username, password: $password) {
      ...ALL
      __typename
    }
  }
  
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
        __typename
      }
      studies {
        id
        name
        __typename
      }
      __typename
    }
    __typename
  }
`;

const LOGIN_BODY_ADMIN = {
  operationName: "login",
  variables: { password: "admin", username: "admin" },
  query: LOGINSTRING
};


module.exports = { LOGIN_BODY_ADMIN };