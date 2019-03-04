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

type FieldInfo {
    id: String!
    study: String!
    Path: String!
    Category: Int!
    FieldID: Int!
    Field: String!
    Participants: Int
    Items: Int!
    Stability: String!
    ValueType: String!
    Units: String
    ItemType: String!
    Strata: String!
    Sexed: String!
    Instances: Int!
    Array: Int!
    Coding: Int
    Notes: String
    Link: String
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
    id: String
    username: String!
    type: USERTYPE!
    realName: String
    email: String
    shortcuts: [ShortCut]
    description: String
    notifications: [Notification!]
    emailNotificationsActivated: Boolean!
    createdBy: String
}

type ShortCut {
    id: String!
    study: String!
    application: String
}

type ApplicationPendingUserApprovals {
    id: String!
    user: String!
    type: String!
}

type Application {
    name: String!
    id: String
    study: String
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
    name: String!
    allUsers: [String]!
    isUkbiobank: Boolean!
    studyAndDataManagers: [String]
    applications: [Application]
    createdBy: String
    iHaveAccess: Boolean!
    jobs: [Job]
}

type QueryEntry {
    id: String!
    queryString: String!
    study: String!
    application: String!
    requester: String!
    claimedBy: String
    lastClaimed: Int
    status: String!
    error: JSON
    cancelled: Boolean
    cancelledTime: Int
    queryResult: String
}

type GenericResponse {
    successful: Boolean!
    id: String
}

input QueryObjInput {
    # apiTranslation: POSSIBLE_API_TRANSLATION,
    queryString: String!
    returnFieldSelection: [String]
    study: String!
    application: String!
}

type Query {
    # USER
    whoAmI: User
    getUsers(username: String): [User]   # admin only

    # STUDY
    getStudies(name: String): [Study]  # only returns the studies that the users are entitled

    # QUERY
    getQueries(study: String, application: String, id: String): [QueryEntry]

    # FIELDS
    getAvailableFields(study: String!, application: String): [FieldInfo]
}

type Mutation {
    # USER
    login(username: String!, password: String!): User
    logout: GenericResponse
    addShortCut(study: String!, application: String): User
    removeShortCut(shortCutId: String!): User

    # APP USERS
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
    rejectPendingApproval(username: String!, study: String!, application: String!): Application

    # QUERY
    createQuery(query: QueryObjInput!): QueryEntry #
}

type Subscription {
    newApplicationCreated(studyName: String!): Application
    applicationDeleted(studyName: String!): String # this is the id of the application
    # queryStatusUpdate(studyName: String!, application: String!): QueryEntry 
}

`;