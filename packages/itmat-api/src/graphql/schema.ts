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
    timestamp: Float
    notificationType: String
    read: Boolean
    data: JSON
}

input CreateUserInput {
    username: String!
    type: USERTYPE!
    realName: String!
    email: String!
    emailNotificationsActivated: Boolean!
    password: String!
}

input EditUserInput {
    username: String!
    type: USERTYPE
    realName: String
    email: String
    emailNotificationsActivated: Boolean
    password: String
}

type User {
    username: String!
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
    getUsers(username: String): [User]   # admin only

    # STUDY
    getStudies(name: String): [Study]  # only returns the studies that the users are entitled
}

type Mutation {
    # USER
    login(username: String!, password: String!): User
    logout: GenericResponse
    createUser(user: CreateUserInput!): GenericResponse
    editUser(user: EditUserInput!): GenericResponse #
    deleteUser(username: String!): GenericResponse

    # STUDY
    createStudy(name: String!): GenericResponse
    deleteStudy(name: String!): GenericResponse #   #admin only
    createApplication(study: String!, application: String!, approvedFields: [String]): GenericResponse
    editApplicationApproveFields: GenericResponse #
    addUserToApplication(username: String!, study: String!, application: String!, type: APPLICATION_USER_TYPE!): GenericResponse
    deleteUserFromApplication(username: String!, study: String!, application: String!): GenericResponse
    purgeUserFromStudy(username: String!, study: String!): GenericResponse #
    applyToBeAddedToApplication(study: String!, application: String!, type: APPLICATION_USER_TYPE!): GenericResponse #

    # QUERY
    createQuery(queryobj: QueryObjInput!): GenericResponse #
}
`;