import { gql } from 'apollo-server-express';

export const schema = gql`
scalar JSON

enum USERTYPE {
    ADMIN
    STANDARD
    SYSTEM
}

enum FIELD_ITEM_TYPE {
    I  #image
    C  #clinical
}

enum FIELD_VALUE_TYPE {
    i # integer
    c # categorical
    d # decimal
    b # boolean
    t # free text

}

type Field {
    id: String!
    studyId: String!
    path: String!
    fieldId: Int!
    fieldName: String!
    valueType: FIELD_VALUE_TYPE!,
    possibleValues: [String],
    unit: String,
    itemType: FIELD_ITEM_TYPE!,
    numOfTimePoints: Int!,
    numOfMeasurements: Int!,
    notes: String
    fieldTreeId: String!
}

type UserAccess {
    id: String!
    projects: [Project]!
    studies: [Study]!
}

type User {
    id: String!
    username: String! # admin only
    otpSecret: String!
    type: USERTYPE!
    realName: String
    organisation: String
    email: String # admin only
    description: String # admin only
    emailNotificationsActivated: Boolean!
    createdBy: String
    createdAt: Float!
    expiredAt: Float!
    # external to mongo documents:
    access: UserAccess # admin or self only
}

type StudyOrProjectUserRole {
    id: String!
    name: String!
    studyId: String
    projectId: String
    permissions: [String]!
    users: [User]!
}

type File {
    id: String!
    fileName: String!
    studyId: String!
    projectId: String
    fileSize: Int
    description: String!
    uploadedBy: String!
}

type DataVersion {
    id: String!
    version: String!
    contentId: String!
    tag: String
    uploadDate: String!
    jobId: String!
    extractedFrom: String!
    fileSize: String!
    fieldTrees: [String]!
}

type Study {
    id: String!
    name: String!
    createdBy: String!
    lastModified: Int!
    currentDataVersion: Int
    dataVersions: [DataVersion]!

    # external to mongo documents:
    jobs: [Job]!
    projects: [Project]!
    roles: [StudyOrProjectUserRole]!
    # fields: [Field]!
    files: [File]!
    numOfSubjects: Int!
}

type ProjectFields {
    fieldTreeId: String!
    fieldsInFieldTree: [Field]!
}

type Project {
    id: String!
    studyId: String!
    name: String!

    #only admin
    patientMapping: JSON!
    approvedFields: JSON!
    approvedFiles: [String]!

    #external to mongo documents:
    jobs: [Job]!
    roles: [StudyOrProjectUserRole]!
    iCanEdit: Boolean
    fields: [ProjectFields]! # fields of the study current dataversion but filtered to be only those in Project.approvedFields
    files: [File]!
}

type Job {
    id: String!
    studyId: String!
    projectId: String
    jobType: String!
    requester: String!
    receivedFiles: [String]!
    requestTime: Float!
    status: String!
    error: [String]
    cancelled: Boolean
    cancelledTime: Int
    data: JSON
}

enum LOG_TYPE {
   SYSTEM_LOG
   REQUEST_LOG
}

enum LOG_STATUS {
    SUCCESS
    FAIL
}

enum LOG_ACTION {
    # SYSTEM
    START_SERVER
    STOP_SERVER

    # USER
    GET_USERS
    EDIT_USER
    DELETE_USER
    CREATE_USER
    LOGIN_USER
    WHO_AM_I
    LOGOUT
    REQUEST_USERNAME_OR_RESET_PASSWORD
    RESET_PASSWORD

    # PROJECT
    GET_PROJECT
    # GET_PROJECT_PATIENT_MAPPING
    EDIT_PROJECT_APPROVED_FIELDS
    EDIT_PROJECT_APPROVED_FILES
    CREATE_PROJECT
    DELETE_PROJECT
    SET_DATAVERSION_AS_CURRENT
    SUBSCRIBE_TO_JOB_STATUS

    # STUDY | DATASET
    DELETE_STUDY
    GET_STUDY
    GET_STUDY_FIELDS
    CREATE_STUDY
    CREATE_DATA_CREATION_JOB
    #CREATE_FIELD_CURATION_JOB

    # STUDY & PROJECT
    EDIT_ROLE
    ADD_NEW_ROLE
    REMOVE_ROLE

    # FILE
    UPLOAD_FILE
    DOWNLOAD_FILE
    DELETE_FILE

    #QUERY
    GET_QUERY
    CREATE_QUERY
    #GET_QUERY_RESULT
}

type Log {
    id: String!,
    requesterName: String,
    requesterType: USERTYPE,
    logType: LOG_TYPE,
    actionType: LOG_ACTION,
    actionData: JSON,
    time: Float!,
    status: LOG_STATUS,
    error: String
}

type QueryEntry {
    id: String!,
    queryString: String!,
    studyId: String!,
    projectId: String,
    requester: String!,
    status: String!,
    error: JSON,
    cancelled: Boolean,
    cancelledTime: Int,
    queryResult: String,
    data_requested: [String],
    cohort: JSON,
    new_fields: JSON
}

type GenericResponse {
    successful: Boolean!
    id: String
}

enum JOB_STATUS {
    finished
    error
    QUEUED
    PROCESSING
    CANCELLED
}

type JobStatusChange_Subscription {
    jobId: String!
    studyId: String!
    newStatus: JOB_STATUS!
    errors: [String]
}

input QueryObjInput {
    queryString: String!
    returnFieldSelection: [String]
    study: String!
    project: String
}

input CreateUserInput {
    username: String!
    type: USERTYPE!
    realName: String!
    email: String!
    description: String!
    organisation: String!
    emailNotificationsActivated: Boolean!
    password: String!
}

input EditUserInput {
    id: String!
    username: String
    type: USERTYPE
    realName: String
    email: String
    description: String
    organisation: String
    emailNotificationsActivated: Boolean
    password: String
    expiredAt: Float
}

input IntArrayChangesInput {
    add: [Int]!
    remove: [Int]!
}

input StringArrayChangesInput {
    add: [String]!
    remove: [String]!
}

type Query {
    # USER
    whoAmI: User
    getUsers(userId: String): [User]

    # STUDY
    getStudy(studyId: String!): Study
    getProject(projectId: String!): Project
    getStudyFields(fieldTreeId: String!, studyId: String!): [Field]

    # QUERY
    getQueries(studyId: String!, projectId: String): [QueryEntry]  # only returns the queries that the user has access to.
    getQueryById(queryId: String!): QueryEntry

    # PERMISSION
    getMyPermissions: [String]

    # LOG
    getLogs(requesterName: String, requesterType: USERTYPE, logType: LOG_TYPE, actionType: LOG_ACTION, status: LOG_STATUS): [Log]
}

type Mutation {
    # USER
    login(username: String!, password: String!, totp: String!): User
    logout: GenericResponse
    requestUsernameOrResetPassword(
        forgotUsername: Boolean!,
        forgotPassword: Boolean!,
        email: String, # only provide email if forgotUsername
        username: String
    ): GenericResponse
    resetPassword(encryptedEmail: String!, token: String!, newPassword: String!): GenericResponse
    createUser(user: CreateUserInput!): GenericResponse

    # APP USERS
    editUser(user: EditUserInput!): User
    deleteUser(userId: String!): GenericResponse

    # STUDY
    createStudy(name: String!): Study
    deleteStudy(studyId: String!): GenericResponse

    # PROJECT
    createProject(studyId: String!, projectName: String!, approvedFields: [String]): Project
    deleteProject(projectId: String!): GenericResponse
    editProjectApprovedFields(projectId: String!, fieldTreeId: String!, approvedFields: [String]!): Project
    editProjectApprovedFiles(projectId: String!, approvedFiles: [String]!): Project

    # ACCESS MANAGEMENT
    addRoleToStudyOrProject(studyId: String!, projectId: String, roleName: String!): StudyOrProjectUserRole
    editRole(roleId: String!, name: String, permissionChanges: StringArrayChangesInput, userChanges: StringArrayChangesInput): StudyOrProjectUserRole
    removeRole(roleId: String!): GenericResponse

    # FILES
    uploadFile(studyId: String!, description: String!, file: Upload!, fileLength: Int): File
    deleteFile(fileId: String!): GenericResponse

    # QUERY
    createQuery(query: QueryObjInput!): QueryEntry

    # CURATION
    createDataCurationJob(file: String!, studyId: String!, tag: String, version: String!): Job
    createFieldCurationJob(file: String!, studyId: String!, dataVersionId: String!, tag: String!): Job
    setDataversionAsCurrent(studyId: String!, dataVersionId: String!): Study

}

type Subscription {
    subscribeToJobStatusChange(studyId: String!): JobStatusChange_Subscription
}
`;
