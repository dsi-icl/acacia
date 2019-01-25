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
    description: String!
    emailNotificationsActivated: Boolean!
    password: String!
}

input EditUserInput {
    username: String!
    type: USERTYPE
    realName: String
    email: String
    description: String
    emailNotificationsActivated: Boolean
    password: String
}

type User {
    id: String,
    username: String!
    type: USERTYPE!
    realName: String
    email: String
    description: String
    notifications: [Notification!]
    emailNotificationsActivated: Boolean!
    createdBy: String
}

type ApplicationPendingUserApprovals {
    id: String!
    user: String!
    type: String!
}

type Application {
    name: String!,
    study: Study,
    id: String,
    pendingUserApprovals: [ApplicationPendingUserApprovals]
    applicationAdmins: [String]
    applicationUsers: [String]
    approvedFields: [String]
}

type Job {
    id: String,
    study: String,
    jobType: String,
    requester: String,
    receivedFiles: String,
    status: String,
    error: String,
    cancelled: Boolean,
    cancelledTime: Int,
    data: JSON
}

type Study {
    id: String,
    name: String!,
    isUkbiobank: Boolean!,
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
    createUser(user: CreateUserInput!): User
    editUser(user: EditUserInput!): User #
    deleteUser(username: String!): GenericResponse

    # STUDY
    createStudy(name: String!, isUkbiobank: Boolean!): Study
    deleteStudy(name: String!): GenericResponse #   #admin only
    addUserToStudyManagers(username: String!, study: String!): Study
    removeUserFromStudyManagers(username: String!, study: String!): Study
    createApplication(study: String!, application: String!, approvedFields: [String]): Study
    deleteApplication(study: String!, application: String!): Study
    editApplicationApproveFields: Application #
    addUserToApplication(username: String!, study: String!, application: String!, type: APPLICATION_USER_TYPE!): Application
    deleteUserFromApplication(username: String!, study: String!, application: String!): Application
    purgeUserFromStudy(username: String!, study: String!): GenericResponse #
    applyToBeAddedToApplication(study: String!, application: String!, type: APPLICATION_USER_TYPE!): GenericResponse #

    # QUERY
    createQuery(queryobj: QueryObjInput!): GenericResponse #
}
`;