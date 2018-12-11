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
}

type Notification {
    timestamp: Int
    comment: String
    read: Boolean
}

input User {
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
    id: string
}

input QueryObjInput {
    apiTranslation: null | POSSIBLE_API_TRANSLATION
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
    login(username: ID!, password: String!): GenericResponse
    logout: GenericResponse
    createUser(user: User): GenericResponse
    editUser(username: ID!, password: String): User
    deleteUser(username: ID!): GenericResponse

    # STUDY
    createStudy(name: ID!): Study
    deleteStudy(name: ID!): GenericResponse    #admin only
    addUserToStudy(username: ID!, study: ID!, type: STUDY_USER_TYPE): GenericResponse
    deleteUserFromStudy(username: ID!, study: ID!): GenericResponse

    # QUERY
    createQuery(queryobj: QueryObjInput): GenericResponse
}
`;