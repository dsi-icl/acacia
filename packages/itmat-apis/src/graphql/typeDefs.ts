import gql from 'graphql-tag';

export const typeDefs = gql`
scalar JSON
scalar BigInt
scalar Upload

enum USERTYPE {
    ADMIN
    STANDARD
    SYSTEM
    GUEST
}

enum FIELD_ITEM_TYPE {
    I  #image
    C  #clinical
}

enum FIELD_VALUE_TYPE {
    int # integer
    dec # decimal
    str # characters/string
    bool # boolean
    date # datetime, temporaily save as string
    file # file id
    json # JSON: array & object
    cat # CATEGORICAL
}

enum STUDYTYPE {
    SENSOR
    CLINICAL
    ANY
}

type ValueCategory {
    id: String!
    code: String!
    description: String
}

enum StandardizationRuleSource {
    value # from a given value
    data # from the value of the field
    fieldDef # from the definitions of the field
    reserved # from the related value entries
    inc # increase by 1
}

# rules for sources
# value: parameter is the value itself
# data: parameter is the key of the data, or paths joined by - for JSON data type;
#        note the input is a whole data reocrd including the subjectId & visitId
# fieldDef: parameter is the name of the attribute of the field definition, e.g., unit
# inc: no parameter needed

type Standardization {
    id: String!
    studyId: String!
    type: String!
    field: [String]!
    path: [String]
    joinByKeys: [String]
    stdRules: [StandardizationRule]
    dataVersion: String
    uploadedAt: Float
    metadata: JSON
    deleted: String
}

type StandardizationRule {
    id: String!
    entry: String!
    source: StandardizationRuleSource!
    parameter: [String]!
    joinByKeys: [String]
    filters: JSON
}

input StandardizationInput {
    type: String!
    field: [String]!
    path: [String]!
    joinByKeys: [String]
    stdRules: [StandardizationRuleInput]
}

input StandardizationRuleInput {
    entry: String!
    source: StandardizationRuleSource!
    parameter: [String]
    filters: JSON
}

type Field {
    id: String!
    studyId: String!
    fieldId: String! # start
    fieldName: String!
    tableName: String
    dataType: FIELD_VALUE_TYPE!
    possibleValues: [ValueCategory]
    metadata: JSON
    unit: String
    comments: String
    dataVersion: String
    dateAdded: String!
    dateDeleted: String
}

input DataClip {
    fieldId: String!
    value: String
    subjectId: String!
    visitId: String!
    file: Upload
    metadata: JSON
}

type UserAccess {
    id: String!
    projects: [Project]!
    studies: [Study]!
}

type UserPermissions {
    projects: [StudyOrProjectUserRole]!
    studies: [StudyOrProjectUserRole]!
}

type User {
    id: String!
    username: String! # admin only
    type: USERTYPE!
    firstname: String
    lastname: String
    organisation: String
    email: String # admin only
    description: String # admin only
    emailNotificationsActivated: Boolean!
    emailNotificationsStatus: JSON
    createdBy: String
    createdAt: Float!
    expiredAt: Float!
    metadata: JSON
    # external to mongo documents:
    access: UserAccess # admin or self only
}

type Pubkey {
    id: String!
    pubkey: String!
    associatedUserId: String
    jwtPubkey: String!
    jwtSeckey: String!
    refreshCounter: Int!
    deleted: String
}

type KeyPairwSignature {
    privateKey: String!
    publicKey: String!
    signature: String
}

type Signature {
    signature: String
}

type AccessToken {
    accessToken: String
}

type OrganisationMetadata {
    siteIDMarker: String
}

input OrganisationMetadataInput {
    siteIDMarker: String
}

type Organisation {
    id: String!
    name: String!
    shortname: String
    containOrg: String
    deleted: String
    metadata: OrganisationMetadata
}

type StudyOrProjectUserRole {
    id: String!
    name: String!
    studyId: String
    projectId: String
    description: String
    permissions: JSON
    users: [User]!
    metadata: JSON
}

type File {
    id: String!
    uri: String!
    fileName: String!
    studyId: String!
    projectId: String
    fileSize: String
    description: String!
    uploadTime: String!
    uploadedBy: String!
    hash: String!
    metadata: JSON
}

type DataVersion {
    id: String!
    version: String!
    contentId: String!
    tag: String
    updateDate: String!
}

type OntologyTree {
    id: String!
    name: String!
    routes: [OntologyRoute]
    dataVersion: String!
    metadata: JSON
    deleted: Float
}

type OntologyRoute {
    id: String!
    path: [String]!
    name: String!
    field: [String]!
    visitRange: [String]
}

input OntologyTreeInput {
    name: String!
    routes: [OntologyRouteInput]
    metadata: JSON
}

input OntologyRouteInput {
    path: [String]!
    name: String!
    field: [String]!
    visitRange: [String]
}

type Study {
    id: String!
    name: String!
    createdBy: String!
    lastModified: Int!
    currentDataVersion: Int
    dataVersions: [DataVersion]!
    description: String
    type: STUDYTYPE
    ontologyTrees: [OntologyTree]
    # external to mongo documents:
    jobs: [Job]!
    projects: [Project]!
    roles: [StudyOrProjectUserRole]!
    # fields: [Field]!
    files: [File]!
    subjects: JSON!
    visits: JSON!
    numOfRecords: [Int]!
    metadata: JSON
}

type Project {
    id: String!
    studyId: String!
    name: String!
    dataVersion: DataVersion
    summary: JSON

    #only admin
    patientMapping: JSON!
    
    #external to mongo documents:
    jobs: [Job]!
    roles: [StudyOrProjectUserRole]!
    iCanEdit: Boolean
    fields: [Field]!
    files: [File]!
    metadata: JSON
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

type Log {
    id: String!
    requesterName: String
    requesterType: String
    userAgent: String
    logType: String
    actionType: String
    actionData: JSON
    time: Float!
    status: String
    error: String
}

type QueryEntry {
    id: String!
    queryString: JSON!
    studyId: String!
    projectId: String
    requester: String!
    status: String!
    error: JSON
    cancelled: Boolean
    cancelledTime: Int
    queryResult: String
    data_requested: [String]
    cohort: JSON
    new_fields: JSON
}

type GenericResponse {
    successful: Boolean!
    id: String,
    code: String,
    description: String
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
    queryString: JSON!
    userId: String!
    studyId: String!
    projectId: String
}

input CreateUserInput {
    username: String!
    type: USERTYPE
    firstname: String!
    lastname: String!
    email: String!
    description: String
    organisation: String!
    emailNotificationsActivated: Boolean
    password: String!,
    metadata: JSON
}

input EditUserInput {
    id: String!
    username: String
    type: USERTYPE
    firstname: String
    lastname: String
    email: String
    description: String
    organisation: String
    emailNotificationsActivated: Boolean
    emailNotificationsStatus: JSON
    password: String
    expiredAt: Float
    metadata: JSON
}

input IntArrayChangesInput {
    add: [Int]!
    remove: [Int]!
}

input StringArrayChangesInput {
    add: [String]!
    remove: [String]!
}

input ValueCategoryInput {
    code: String!
    description: String
}

input FieldInput {
    fieldId: String! # start
    fieldName: String!
    tableName: String
    dataType: FIELD_VALUE_TYPE!
    possibleValues: [ValueCategoryInput]
    unit: String
    comments: String
    metadata: JSON
}

type SubjectDataRecordSummary {
    subjectId: String!
    visitId: String!
    fieldId: String!
    error: String!
}

type Query {
    # USER
    whoAmI: User
    getUsers(userId: String): [User]
    validateResetPassword(encryptedEmail: String!, token: String!): GenericResponse
    recoverSessionExpireTime: GenericResponse

    # ORGANISATION
    getOrganisations(organisationId: String): [Organisation]

    # PUBLIC KEY AUTHENTICATION
    getPubkeys(pubkeyId: String, associatedUserId: String): [Pubkey]

    # STUDY
    getStudy(studyId: String!): Study
    getProject(projectId: String!): Project
    getStudyFields(studyId: String!, projectId: String, versionId: String): [Field]
    getDataRecords(studyId: String!, queryString: JSON, versionId: String, projectId: String): JSON
    getOntologyTree(studyId: String!, projectId: String, treeName: String, versionId: String): [OntologyTree]
    getStandardization(studyId: String, projectId: String, type: String, versionId: String): [Standardization]
    checkDataComplete(studyId: String!): [SubjectDataRecordSummary]
    
    # QUERY
    getQueries(studyId: String, projectId: String): [QueryEntry]  # only returns the queries that the user has access to.
    getQueryById(queryId: String!): QueryEntry

    # PERMISSION
    getGrantedPermissions(studyId: String, projectId: String): UserPermissions

    # LOG
    getLogs(requesterName: String, requesterType: String, logType: String, actionType: String, status: String): [Log]
}

type Mutation {
    # USER
    login(username: String!, password: String!, totp: String!, requestexpirydate: Boolean): User
    logout: GenericResponse
    requestUsernameOrResetPassword(
        forgotUsername: Boolean!,
        forgotPassword: Boolean!,
        email: String, # only provide email if forgotUsername
        username: String
    ): GenericResponse
    resetPassword(encryptedEmail: String!, token: String!, newPassword: String!): GenericResponse
    createUser(user: CreateUserInput!): GenericResponse
    requestExpiryDate(username: String, email: String): GenericResponse
    
    # PUBLIC KEY AUTHENTICATION
    registerPubkey(pubkey: String!, signature: String!, associatedUserId: String): Pubkey    
    issueAccessToken(pubkey: String!, signature: String!): AccessToken
    keyPairGenwSignature: KeyPairwSignature
    rsaSigner(privateKey: String!, message: String): Signature

    # ORGANISATION
    createOrganisation(name: String!, shortname: String, containOrg: String, metadata: OrganisationMetadataInput): Organisation
    deleteOrganisation(id: String!): Organisation

    # APP USERS
    editUser(user: EditUserInput!): User
    deleteUser(userId: String!): GenericResponse

    # STUDY
    createStudy(name: String!, description: String, type: STUDYTYPE!): Study
    deleteStudy(studyId: String!): GenericResponse
    editStudy(studyId: String!, description: String): Study
    createNewDataVersion(studyId: String!, dataVersion: String!, tag: String): DataVersion
    uploadDataInArray(studyId: String!, data: [DataClip]): [GenericResponse]
    deleteDataRecords(studyId: String!, subjectIds: [String], visitIds: [String], fieldIds: [String]): [GenericResponse]
    createNewField(studyId: String!, fieldInput: [FieldInput]!): [GenericResponse]
    editField(studyId: String!, fieldInput: FieldInput!): Field
    deleteField(studyId: String!, fieldId: String!): Field
    createOntologyTree(studyId: String!, ontologyTree: OntologyTreeInput!): OntologyTree
    deleteOntologyTree(studyId: String!, treeName: String!): GenericResponse

    # STANDARDIZATION
    createStandardization(studyId: String!, standardization: StandardizationInput): Standardization
    deleteStandardization(studyId: String!, type: String, field: [String]!): GenericResponse

    # PROJECT
    createProject(studyId: String!, projectName: String!): Project
    deleteProject(projectId: String!): GenericResponse

    # ACCESS MANAGEMENT
    addRole(studyId: String!, projectId: String, roleName: String!): StudyOrProjectUserRole
    editRole(roleId: String!, name: String, description: String, permissionChanges: JSON, userChanges: StringArrayChangesInput): StudyOrProjectUserRole
    removeRole(roleId: String!): GenericResponse

    # FILES
    uploadFile(studyId: String!, description: String!, file: Upload!, fileLength: BigInt, hash: String): File
    deleteFile(fileId: String!): GenericResponse

    # QUERY
    createQuery(query: QueryObjInput!): QueryEntry

    # CURATION
    setDataversionAsCurrent(studyId: String!, dataVersionId: String!): Study

}

type Subscription {
    subscribeToJobStatusChange(studyId: String!): JobStatusChange_Subscription
}
`;
