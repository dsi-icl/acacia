import { userTypes } from './user';

export interface ILogEntry {
    id: string,
    requesterName: string,
    requesterType: userTypes,
    logType: LOG_TYPE,
    actionType: LOG_ACTION,
    actionData: any,
    time: number,
    status: LOG_STATUS,
    errors: string | null
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

    // PROJECT
    getProject = 'GET_PROJECT',
    // GET_PROJECT_PATIENT_MAPPING = 'GET_PROJECT_PATIENT_MAPPING',
    editProjectApprovedFields = 'EDIT_PROJECT_APPROVED_FIELDS',
    editProjectApprovedFiles = 'EDIT_PROJECT_APPROVED_FILES',
    createProject = 'CREATE_PROJECT',
    deleteProject = 'DELETE_PROJECT',
    setDataversionAsCurrent = 'SET_DATAVERSION_AS_CURRENT',
    subscribeToJobStatusChange = 'SUBSCRIBE_TO_JOB_STATUS',

    // STUDY | DATASET
    deleteStudy = 'DELETE_STUDY',
    getStudy = 'GET_STUDY',
    getStudyFields = 'GET_STUDY_FIELDS',
    createStudy = 'CREATE_STUDY',
    createDataCurationJob = 'CREATE_DATA_CREATION_JOB',
    //createDataCurationJob = 'CREATE_FIELD_CURATION_JOB',

    // STUDY & PROJECT
    editRole = 'EDIT_ROLE',
    addRoleToStudyOrProject = 'ADD_NEW_ROLE',
    removeRole = 'REMOVE_ROLE',

    // FILE
    uploadFile = 'UPLOAD_FILE',
    DOWNLOAD_FILE = 'DOWNLOAD_FILE',
    deleteFile = 'DELETE_FILE',

    //QUERY
    getQueries = 'GET_QUERY',
    createQuery = 'CREATE_QUERY',
    //GET_QUERY_RESULT = 'GET_QUERY_RESULT'

}

export enum LOG_STATUS {
    SUCCESS = 'SUCCESS',
    FAIL = 'FAIL'
}
