import { gql } from 'apollo-server-express';

export const typeDefs = gql`
scalar JSON
scalar BigInt
scalar Upload

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
    path: [String]!
    joinByKeys: [String]
    stdRules: [StandardizationRule]
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

type GeneralError {
    code: String!
    description: String
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
    createdBy: String
    createdAt: Float!
    expiredAt: Float!
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
    permissions: [String]!
    users: [User]!
}

type File {
    id: String!
    fileName: String!
    studyId: String!
    projectId: String
    fileSize: String
    description: String!
    uploadTime: String!
    uploadedBy: String!
    hash: String!
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
    subjects: [String]!
    visits: [String]!
    numOfRecords: Int!
}

type Project {
    id: String!
    studyId: String!
    name: String!
    dataVersion: DataVersion
    summary: JSON

    #only admin
    patientMapping: JSON!
    approvedFields: JSON!
    approvedFiles: [String]!

    #external to mongo documents:
    jobs: [Job]!
    roles: [StudyOrProjectUserRole]!
    iCanEdit: Boolean
    fields: [Field]! # fields of the study current dataversion but filtered to be only those in Project.approvedFields
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

enum USER_AGENT {
    MOZILLA
    OTHER
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
    REQUEST_EXPIRY_DATE

    # KEY
    REGISTER_PUBKEY
    ISSUE_ACCESS_TOKEN
    KEYPAIRGEN_SIGNATURE
    RSA_SIGNER
    LINK_USER_PUBKEY

    # ORGANISATION
    GET_ORGANISATIONS
    CREATE_ORGANISATION
    DELETE_ORGANISATION

    # PROJECT
    GET_PROJECT
    # GET_PROJECT_PATIENT_MAPPING = 'GET_PROJECT_PATIENT_MAPPING',
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
    EDIT_STUDY
    CREATE_DATA_CURATION_JOB
    CREATE_FIELD_CURATION_JOB
    GET_DATA_RECORDS
    GET_ONTOLOGY_TREE
    CHECK_DATA_COMPLETE
    CREATE_NEW_DATA_VERSION
    UPLOAD_DATA_IN_ARRAY
    DELETE_DATA_RECORDS
    CREATE_NEW_FIELD
    EDIT_FIELD
    DELETE_FIELD
    ADD_ONTOLOGY_TREE
    DELETE_ONTOLOGY_TREE

    # STUDY & PROJECT
    EDIT_ROLE
    ADD_NEW_ROLE
    REMOVE_ROLE

    # FILE
    UPLOAD_FILE
    DOWNLOAD_FILE
    DELETE_FILE

    # QUERY
    GET_QUERY
    CREATE_QUERY
    GET_QUERY_BY_ID
    CREATE_QUERY_CURATION_JOB
}

type Log {
    id: String!
    requesterName: String
    requesterType: USERTYPE
    userAgent: USER_AGENT
    logType: LOG_TYPE
    actionType: LOG_ACTION
    actionData: JSON
    time: Float!
    status: LOG_STATUS
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
    password: String!
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
}

type SubjectDataRecordSummary {
    subjectId: String!
    visitId: String
    errorFields: [String]
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
    getOntologyTree(studyId: String!, projectId: String, treeId: String): [OntologyTree]
    getStandardization(studyId: String, projectId: String, type: String): [Standardization]
    checkDataComplete(studyId: String!): [SubjectDataRecordSummary]
    
    # QUERY
    getQueries(studyId: String, projectId: String): [QueryEntry]  # only returns the queries that the user has access to.
    getQueryById(queryId: String!): QueryEntry

    # PERMISSION
    getGrantedPermissions(studyId: String, projectId: String): UserPermissions

    # LOG
    getLogs(requesterName: String, requesterType: USERTYPE, logType: LOG_TYPE, actionType: LOG_ACTION, status: LOG_STATUS): [Log]
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
    uploadDataInArray(studyId: String!, data: [DataClip]): [GeneralError]
    deleteDataRecords(studyId: String!, subjectIds: [String], visitIds: [String], fieldIds: [String]): [GeneralError]
    createNewField(studyId: String!, fieldInput: [FieldInput]!): [GeneralError]
    editField(studyId: String!, fieldInput: FieldInput!): Field
    deleteField(studyId: String!, fieldId: String!): Field
    createOntologyTree(studyId: String!, ontologyTree: OntologyTreeInput!): OntologyTree
    deleteOntologyTree(studyId: String!, treeId: String!): GenericResponse

    # STANDARDIZATION
    createStandardization(studyId: String!, standardization: StandardizationInput): Standardization
    deleteStandardization(studyId: String!, stdId: String!): GenericResponse

    # PROJECT
    createProject(studyId: String!, projectName: String!, approvedFields: [String]): Project
    deleteProject(projectId: String!): GenericResponse
    editProjectApprovedFields(projectId: String!, approvedFields: [String]!): Project
    editProjectApprovedFiles(projectId: String!, approvedFiles: [String]!): Project

    # ACCESS MANAGEMENT
    addRoleToStudyOrProject(studyId: String!, projectId: String, roleName: String!): StudyOrProjectUserRole
    editRole(roleId: String!, name: String, permissionChanges: StringArrayChangesInput, userChanges: StringArrayChangesInput): StudyOrProjectUserRole
    removeRole(roleId: String!): GenericResponse

    # FILES
    uploadFile(studyId: String!, description: String!, file: Upload!, fileLength: BigInt, hash: String): File
    deleteFile(fileId: String!): GenericResponse

    # QUERY
    createQuery(query: QueryObjInput!): QueryEntry

    # CURATION
    createDataCurationJob(file: [String]!, studyId: String!): [Job]
    createFieldCurationJob(file: String!, studyId: String!, tag: String!): Job
    createQueryCurationJob(queryId: [String], studyId: String, projectId: String): Job
    setDataversionAsCurrent(studyId: String!, dataVersionId: String!): Study

}

type Subscription {
    subscribeToJobStatusChange(studyId: String!): JobStatusChange_Subscription
}
`;
