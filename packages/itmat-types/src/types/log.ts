import { userTypes } from './user';

export interface ILogEntry {
    id: string,
    requesterName: string,
    requesterType: userTypes,
    userAgent: USER_AGENT,
    logType: LOG_TYPE,
    actionType: LOG_ACTION,
    actionData: string,
    time: number,
    status: LOG_STATUS,
    errors: string | null
}

export enum USER_AGENT {
    MOZILLA = 'MOZILLA',
    OTHER = 'OTHER'
}

export enum LOG_TYPE {
    SYSTEM_LOG = 'SYSTEM_LOG',
    REQUEST_LOG = 'REQUEST_LOG'
}

export enum LOG_ACTION {
    // SYSTEM
    startSERVER = 'START_SERVER',
    stopSERVER = 'STOP_SERVER',

    // USER
    getUsers = 'GET_USERS',
    EditUser = 'EDIT_USER',
    DeleteUser = 'DELETE_USER',
    CreateUser = 'CREATE_USER',
    login = 'LOGIN_USER',
    whoAmI = 'WHO_AM_I',
    logout = 'LOGOUT',
    requestUsernameOrResetPassword = 'REQUEST_USERNAME_OR_RESET_PASSWORD',
    resetPassword = 'RESET_PASSWORD',

    // KEY
    registerPubkey = 'REGISTER_PUBKEY',
    issueAccessToken = 'ISSUE_ACCESS_TOKEN',
    keyPairGenwSignature = 'KEYPAIRGEN_SIGNATURE',
    rsaSigner = 'RSA_SIGNER',
    linkUserPubkey = 'LINK_USER_PUBKEY',

    // ORGANISATION
    createOrganisation = 'CREATE_ORGANISATION',
    deleteOrganisation = 'DELETE_ORGANISATION',

    // PROJECT
    getProject = 'GET_PROJECT',
    // GET_PROJECT_PATIENT_MAPPING = 'GET_PROJECT_PATIENT_MAPPING',
    createProject = 'CREATE_PROJECT',
    deleteProject = 'DELETE_PROJECT',
    setDataversionAsCurrent = 'SET_DATAVERSION_AS_CURRENT',
    subscribeToJobStatusChange = 'SUBSCRIBE_TO_JOB_STATUS',

    // STUDY | DATASET
    deleteStudy = 'DELETE_STUDY',
    getStudy = 'GET_STUDY',
    getStudyFields = 'GET_STUDY_FIELDS',
    createStudy = 'CREATE_STUDY',
    editStudy = 'EDIT_STUDY',
    createFieldCurationJob = 'CREATE_FIELD_CREATION_JOB',
    createDataCurationJob = 'CREATE_DATA_CURATION_JOB',
    getDataRecords = 'GET_DATA_RECORDS',
    getOntologyTree = 'GET_ONTOLOGY_TREE',
    checkDataComplete = 'CHECK_DATA_COMPLETE',
    createNewDataVersion = 'CREATE_NEW_DATA_VERSION',
    uploadDataInArray = 'UPLOAD_DATA_IN_ARRAY',
    deleteDataRecords = 'DELETE_DATA_RECORDS',
    createNewField = 'CREATE_NEW_FIELD',
    editField = 'EDIT_FIELD',
    deleteField = 'DELETE_FIELD',
    addOntologyField = 'ADD_ONTOLOGY_FIELD',
    deleteOntologyField = 'DELETE_ONTOLOGY_FIELD',

    // STUDY & PROJECT
    editRole = 'EDIT_ROLE',
    addRole = 'ADD_NEW_ROLE',
    removeRole = 'REMOVE_ROLE',

    // FILE
    uploadFile = 'UPLOAD_FILE',
    DOWNLOAD_FILE = 'DOWNLOAD_FILE',
    deleteFile = 'DELETE_FILE',

    //QUERY
    getQueries = 'GET_QUERY',
    createQuery = 'CREATE_QUERY',
    getQueryById = 'GET_QUERY_BY_ID',
    createQueryCurationJob = 'CREATE_QUERY_CURATION_JOB'

}

export enum LOG_STATUS {
    SUCCESS = 'SUCCESS',
    FAIL = 'FAIL'
}
