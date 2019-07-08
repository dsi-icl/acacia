import { gql } from 'apollo-server-express';

export const schema = gql`
scalar JSON

enum USERTYPE {
    ADMIN
    STANDARD
}

enum FIELD_ITEM_TYPE {
    I  #image
    C  #clinical
}

enum FIELD_VALUE_TYPE {
    N # numeric
    SC  # categorical single
    MC  # categorical multiple
    D # date-time
    T # free text

}

enum CURATION_JOB_TYPE {
    FIELD_INFO_UPLOAD
    DATA_UPLOAD
}

type FieldInfo {
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
}

type UserAccess {
    id: String!
    projects: [Project]!
    studies: [Study]!
}

type User {
    id: String!
    username: String! # admin only
    type: USERTYPE!
    realName: String
    organisation: String
    email: String # admin only
    description: String # admin only
    emailNotificationsActivated: Boolean!
    createdBy: String

    # external to mongo documents:
    access: UserAccess # admin or self only
}

type ShortCut {
    id: String!
    study: String!
    project: String
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
    id: String!,
    fileName: String!,
    studyId: String!,
    projectId: String,
    fileSize: Int,
    description: String!,
    uploadedBy: String!
}

type Study {
    id: String!
    name: String!
    createdBy: String!
    lastModified: Int!

    # external to mongo documents:
    jobs: [Job]!
    projects: [Project]!
    roles: [StudyOrProjectUserRole]!
    fields: [FieldInfo]!
    files: [File]!
}

type Project {
    id: String!
    studyId: String!
    name: String!

    #only admin
    patientMapping: JSON!
    approvedFields: [String]!

    #external to mongo documents:
    jobs: [Job]
    roles: [StudyOrProjectUserRole]!
    iCanEdit: Boolean
    fields: [FieldInfo]! # fields of the study but filtered to be only those in Project.approvedFields
    files: [File]!
}

type Job {
    id: String!,
    studyId: String!,
    projectId: String,
    jobType: String!,
    requester: String!,
    receivedFiles: [String]!,
    status: String!,
    error: String,
    cancelled: Boolean,
    cancelledTime: Int,
    data: JSON
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

    # QUERY
    getQueries(studyId: String!, projectId: String): [QueryEntry]  # only returns the queries that the user has access to.
    getQueryById(queryId: String!): QueryEntry

    # FIELDS
    getAvailableFields(studyId: String, projectId: String): [FieldInfo]!

    # PERMISSION
    getMyPermissions: [String]
}

type Mutation {
    # USER
    login(username: String!, password: String!): User
    logout: GenericResponse

    # APP USERS
    createUser(user: CreateUserInput!): User
    editUser(user: EditUserInput!): User
    deleteUser(userId: String!): GenericResponse

    # STUDY
    createStudy(name: String!, isUkbiobank: Boolean!): Study
    deleteStudy(studyId: String!): GenericResponse

    # PROJECT
    createProject(studyId: String!, projectName: String!, approvedFields: [String]): Project
    deleteProject(projectId: String!): GenericResponse
    editProjectApprovedFields(projectId: String!, approvedFields: [String]!): Project

    # ACCESS MANAGEMENT
    addRoleToStudyOrProject(studyId: String!, projectId: String, roleName: String!): StudyOrProjectUserRole
    editRole(roleId: String!, name: String, permissionChanges: StringArrayChangesInput, userChanges: StringArrayChangesInput): StudyOrProjectUserRole
    removeRole(roleId: String!): GenericResponse

    # FILES
    uploadFile(studyId: String!, projectId: String, description: String!, file: Upload!, fileLength: Int): File
    deleteFile(studyId: String!, projectId: String, fileId: String!): GenericResponse


    # QUERY
    createQuery(query: QueryObjInput!): QueryEntry

    # CURATION
    createCurationJob(file: Upload!, studyId: String!, jobType: CURATION_JOB_TYPE): Job
    createDataExportJob(studyId: String!, projectId: String): Job
}

type Subscription {
    stub: GenericResponse
}
`;