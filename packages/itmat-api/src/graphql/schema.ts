import { gql } from 'apollo-server-express';

export const schema = gql`
scalar JSON

enum USERTYPE {
    ADMIN
    STANDARD
}

enum APPLICATION_USER_TYPE {
    APPLICATION_ADMIN
    APPLICATION_USER
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

input CreateUserInput {
    username: ID!
    type: USERTYPE!
    realName: String!
    email: String!
    emailNotificationsActivated: Boolean!
    password: String!
}

input EditUserInput {
    username: ID!
    type: USERTYPE
    realName: String
    email: String
    emailNotificationsActivated: Boolean
    password: String
}

type User {
    username: ID!
    type: USERTYPE!
    realName: String
    email: String
    notifications: [Notification!]
    emailNotificationsActivated: Boolean!
    createdBy: String
}

type ApplicationPendingUserApprovals {
    user: String!
    type: String!
}

type Application {
    name: String!,
    pendingUserApprovals: [ApplicationPendingUserApprovals]
    applicationAdmins: [String]
    applicationUsers: [String]
    approvedFields: [String]
}

type Job {
    id: String,
    study: String
    application: String,
    requester: String,
    receivedFiles: String,
    status: String,
    error: String,
    cancelled: Boolean,
    cancelledTime: Int,
    data: JSON
}

type Study {
    name: String!,
    studyAndDataManagers: [String]
    applications: [Application]
    createdBy: String
    jobs: [Job]
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
    getUsers(username: ID): [User]   # admin only

    # STUDY
    getStudies(name: ID): [Study]  # only returns the studies that the users are entitled
}

type Mutation {
    # USER
    login(username: ID!, password: String!): User
    logout: GenericResponse
    createUser(user: CreateUserInput!): GenericResponse
    editUser(user: EditUserInput!): GenericResponse #
    deleteUser(username: ID!): GenericResponse

    # STUDY
    createStudy(name: ID!): GenericResponse
    deleteStudy(name: ID!): GenericResponse #   #admin only
    createApplication(study: ID!, application: String!, approvedFields: [String]): GenericResponse
    editApplicationApproveFields: GenericResponse #
    addUserToApplication(username: ID!, study: ID!, application: String!, type: APPLICATION_USER_TYPE!): GenericResponse
    deleteUserFromApplication(username: ID!, study: ID!, application: ID!): GenericResponse
    purgeUserFromStudy(username: ID!, study: ID!): GenericResponse #
    applyToBeAddedToStudy(study: ID!, type: APPLICATION_USER_TYPE): GenericResponse #

    # QUERY
    createQuery(queryobj: QueryObjInput!): GenericResponse #
}
`;