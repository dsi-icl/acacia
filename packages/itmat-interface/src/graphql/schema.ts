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
    N  #numeric
    C  #categorical
}

type FieldInfo {
    id: String!
    study: String!
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

type User {
    id: String!
    username: String!
    type: USERTYPE!
    realName: String
    email: String
    shortcuts: [ShortCut]
    description: String
    emailNotificationsActivated: Boolean!
    createdBy: String
}

type ShortCut {
    id: String!
    study: String!
    project: String
}


type StudyOrProjectUserRole {
    id: String!,
    name: String!,
    studyId: String,
    projectId: String,
    permissions: [String]!,
    users: [String]!
}

type Project {
    id: String!
    studyId: String!
    name: String!
    patientMapping: JSON!
    approvedFields: [String]!

    # external to mongo documents:
    jobs: [Job]
    roles: [StudyOrProjectUserRole]
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
    id: String!,
    name: String!,
    isUkbiobank: Boolean!,
    createdBy: String!,
    lastModified: Int,
    deleted: Boolean
    iHaveAccess: Boolean!

    # external to mongo documents:
    jobs: [Job]
    projects: [Project]
    roles: [StudyOrProjectUserRole]
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
    getUsers(userId: String): [User]   # admin only

    # STUDY
    getStudies(studyId: String): [Study]  # only returns the studies that the users are entitled
    getProjects(projectId: String): Project

    # QUERY
    getQueries(studyId: String!, projectId: String): [QueryEntry]  # only returns the queries that the user has access to.
    getQueryById(queryId: String!): QueryEntry

    # FIELDS
    getAvailableFields(studyId: String, projectId: String): [FieldInfo]

    # PERMISSION
    getMyPermissions: [String]
}

type Mutation {
    # USER
    login(username: String!, password: String!): User
    logout: GenericResponse
    addShortCut(study: String!, project: String): User
    removeShortCut(shortCutId: String!): User

    # APP USERS
    createUser(user: CreateUserInput!): User
    editUser(user: EditUserInput!): User
    deleteUser(username: String!): GenericResponse

    # STUDY
    createStudy(name: String!, isUkbiobank: Boolean!): Study
    deleteStudy(studyId: String!): GenericResponse

    # PROJECT
    createProject(studyId: String!, projectName: String!, approvedFields: [String]): Study
    deleteProject(projectId: String!): GenericResponse
    editProjectApprovedFields(projectId: String!, changes: IntArrayChangesInput): Project

    # ACCESS MANAGEMENT
    addRoleToStudyOrProject(studyId: String, projectId: String, roleName: String!, permissions: [String]!): StudyOrProjectUserRole
    editRole(roleId: String!, name: String, permissionChanges: StringArrayChangesInput, userChanges: StringArrayChangesInput): StudyOrProjectUserRole
    removeRole(roleId: String!): GenericResponse

    # QUERY
    createQuery(query: QueryObjInput!): QueryEntry
}

type Subscription {
    stub: GenericResponse
}
`;