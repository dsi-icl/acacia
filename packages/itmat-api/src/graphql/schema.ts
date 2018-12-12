import { gql } from 'apollo-server-express';

export const schema = gql`
enum USERTYPE {
    ADMIN
    STANDARD
}

enum STUDY_USER_TYPE {
    DATA_ADMIN
    DATA_USER
}

enum POSSIBLE_API_TRANSLATION {
    XNAT
    TRANSMART
    NONE
}

type Notification {
    timestamp: Int
    comment: String
    read: Boolean
}

input UserInput {
    username: ID!
    type: USERTYPE!
    realName: String!
    email: String!
    emailNotificationsActivated: Boolean!
    password: String!
}

type User {
    username: ID!
    type: USERTYPE!
    realName: String
    email: String
    notifications: [Notification]!
    emailNotificationsActivated: Boolean!
    createdBy: String
}

type Study {
    name: String!
    createdBy: String
    dataAdmins: [String]
    dataUsers: [String]
}

type GenericResponse {
    successful: Boolean!
    id: String
}

input QueryObjInput {
    apiTranslation: POSSIBLE_API_TRANSLATION
    # TO_DO
}

type Query {
    # USER
    whoAmI: User
    getUsers(username: ID): [User]   #admin only

    # STUDY
    getStudies(name: ID): [Study]    #only returns the studies that the users are entitled
}

type Mutation {
    # USER
    login(username: ID!, password: String!): User
    logout: GenericResponse
    createUser(user: UserInput!): GenericResponse
    editUser(username: ID!, password: String): User
    deleteUser(username: ID!): GenericResponse

    # STUDY
    createStudy(name: ID!): GenericResponse
    deleteStudy(name: ID!): GenericResponse    #admin only
    addUserToStudy(username: ID!, study: ID!, type: STUDY_USER_TYPE): GenericResponse
    deleteUserFromStudy(username: ID!, study: ID!): GenericResponse

    # QUERY
    createQuery(queryobj: QueryObjInput!): GenericResponse
}
`;