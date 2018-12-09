import { gql } from 'apollo-server-express';

export const schema = gql`
enum USERTYPE {
    ADMIN
    STANDARD
}

type User {
    username: ID!
    type: USERTYPE
    createdBy: String
}

type Study {
    name: String!
    createdBy: String
}

type Query {
    whoAmI: User,
    getUsers(username: ID): [User]   #admin only
    getStudies(name: ID): [Study]    #only returns the studies that the users are entitled
}

type GenericResponse {
    error: Boolean
    successful: Boolean
    errorMsg: String
}

type Mutation {
    login(username: ID!, password: String!): GenericResponse
    logout: GenericResponse
    createUser(username: ID!, password: String!): User
    editUser(username: ID!, password: String): User
    deleteUser(username: ID!): GenericResponse
    createStudy(name: ID!): Study
    deleteStudy(name: ID!): GenericResponse    #admin only
}
`;