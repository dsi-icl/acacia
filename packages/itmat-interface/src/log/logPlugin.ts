import { db } from '../database/database';
import { v4 as uuid } from 'uuid';
import { LOG_TYPE, LOG_ACTION, LOG_STATUS, USER_AGENT, userTypes } from '@itmat-broker/itmat-types';

// only requests in white list will be recorded
export const logActionRecordWhiteList = Object.keys(LOG_ACTION);

// only requests in white list will be recorded
export const logActionShowWhiteList = Object.keys(LOG_ACTION);

// fields that carry sensitive information will be ignored
export const ignoredFields = {
    login: ['password', 'totp']
};

// define global api parameters
export const apiParameters = {
    GET_USERS: ['fetchDetailsAdminOnly', 'fetchAccessPrivileges', 'userId'],
    EDIT_USER: ['id', 'username', 'type', 'firstname', 'lastname', 'email', 'emailNotificationsActivated', 'password', 'description', 'organisation', 'expiredAt'],
    DELETE_USER: ['userId'],
    CREATE_USER: ['username', 'password', 'firstname', 'lastname', 'description', 'organisation', 'emailNotificationsActivated', 'email', 'type'],
    LOGIN_USER: ['username', 'password', 'totp'],
    WHO_AM_I: [],
    LOGOUT: [],
    REQUEST_USERNAME_OR_RESET_PASSWORD: ['forgotUsername', 'forgotPassword', 'email', 'username'],
    RESET_PASSWORD: ['encryptedEmail', 'token', 'newPassword'],
    VALIDATE_RESET_PASSWORD: ['encryptedEmail', 'token'],
    GET_PROJECT: ['projectId', 'admin'],
    GET_PROJECT_PATIENT_MAPPING: ['projectId'],
    EDIT_PROJECT_APPROVED_FIELDS: ['projectId', 'fieldTreeId', 'approvedFields'],
    EDIT_PROJECT_APPROVED_FILES: ['projectId', 'approvedFiles'],
    CREATE_PROJECT: ['studyId', 'projectName', 'approvedFields'],
    DELETE_PROJECT: ['projectId'],
    SET_DATAVERSION_AS_CURRENT: ['studyId', 'dataVersionId'],
    SUBSCRIBE_TO_JOB_STATUS: ['studyId'],
    DELETE_STUDY: ['studyId'],
    GET_STUDY: ['studyId'],
    GET_STUDY_FIELDS: ['studyId', 'versionId', 'projectId'],
    CREATE_STUDY: ['name'],
    CREATE_DATA_CURATION_JOB: ['file', 'studyId', 'tag', 'version'],
    CREATE_FIELD_CURATION_JOB: ['file', 'studyId', 'tag', 'dataVersionId'],
    EDIT_ROLE: ['roleId', 'name', 'permissionChanges', 'userChanges'],
    ADD_NEW_ROLE: ['studyId', 'projectId', 'roleName'],
    REMOVE_ROLE: ['roleId'],
    UPLOAD_FILE: ['studyId', 'file', 'description', 'fileLength'],
    DOWNLOAD_FILE: [],
    DELETE_FILE: ['fileId'],
    GET_QUERIES: ['studyId', 'projectId', 'id'],
    GET_QUERY_BYID: ['id'],
    CREATE_QUERY: ['queryString', 'returnFieldSelection', 'study', 'project'],
    GET_QUERY_RESULT: ['id'],
    GET_LOGS: ['requesterName', 'requesterType', 'logType', 'actionType'],
    GET_ORGANISATIONS: ['organisationId'],
    CREATE_ORGANISATION: ['name', 'shortname', 'containOrg'],
    DELETE_ORGANISATION: ['id'],
    GET_GRANTED_PERMISSIONS: ['studyId', 'projectId'],
    GET_PUBKEYS: ['pubkeyId', 'associatedUserId'],
    REGISTER_PUBKEY: ['associatedUserId'],
    LINK_USER_PUBKEY: ['associatedUserId'],
    ISSUE_ACCESS_TOKEN: [],
    KEYPAIRGEN_SIGNATURE: [],
    RSA_SIGNER: [],
    GET_DATA_RECORDS: ['studyId', 'versionId', 'projectId'],
    GET_ONTOLOGY_TREE: ['studyId', 'projectId'],
    CHECK_DATA_COMPLETE: ['studyId'],
    CREATE_NEW_DATA_VERSION: ['studyId', 'dataVersion', 'tag'],
    UPLOAD_DATA_IN_ARRAY: ['studyId'],
    DELETE_DATA_RECORDS: ['studyId', 'subjectIds', 'visitIds', 'fieldIds'],
    CREATE_NEW_FIELD: ['studyId'],
    EDIT_FIELD: ['studyId', 'fieldIdInput'],
    DELETE_FIELD: ['studyId', 'fieldId'],
    CREATE_ONTOLOGY_TREE: ['studyId'],
    DELETE_ONTOLOGY_TREE: ['studyId', 'treeId'],
    GET_STANDARDIZATION: ['studyId', 'projetId', 'type'],
    CREATE_STANDARDIZATION: ['studyId'],
    DELETE_STANDARDIZATION: ['studyId', 'stdId'],
    CREATE_QUERY_CURATION_JOB: ['queryId', 'studyId', 'projectId']
};

export class LogPlugin {
    public async serverWillStartLogPlugin(): Promise<null> {
        await db.collections!.log_collection.insertOne({
            id: uuid(),
            requesterName: userTypes.SYSTEM,
            requesterType: userTypes.SYSTEM,
            logType: LOG_TYPE.SYSTEM_LOG,
            actionType: LOG_ACTION.startSERVER,
            actionData: JSON.stringify({}),
            time: Date.now(),
            status: LOG_STATUS.SUCCESS,
            errors: '',
            userAgent: USER_AGENT.OTHER
        });
        return null;
    }

    public async requestDidStartLogPlugin(requestContext: any): Promise<null> {
        if (!logActionRecordWhiteList.includes(requestContext.operationName)) {
            return null;
        }
        if ((LOG_ACTION as any)[requestContext.operationName] === undefined || (LOG_ACTION as any)[requestContext.operationName] === null) {
            return null;
        }
        await db.collections!.log_collection.insertOne({
            id: uuid(),
            requesterName: requestContext.contextValue?.req?.user?.username ?? 'NA',
            requesterType: requestContext.contextValue?.req?.user?.type ?? userTypes.SYSTEM,
            userAgent: (requestContext.contextValue.req.headers['user-agent'] as string)?.startsWith('Mozilla') ? USER_AGENT.MOZILLA : USER_AGENT.OTHER,
            logType: LOG_TYPE.REQUEST_LOG,
            actionType: (LOG_ACTION as any)[requestContext.operationName],
            actionData: JSON.stringify(ignoreFieldsHelper(requestContext.request.variables, requestContext.operationName)),
            time: Date.now(),
            status: requestContext.errors === undefined ? LOG_STATUS.SUCCESS : LOG_STATUS.FAIL,
            errors: requestContext.errors === undefined ? '' : requestContext.errors[0].message
        });
        return null;
    }
}

function ignoreFieldsHelper(dataObj: any, operationName: string) {
    if (Object.keys(ignoredFields).includes(operationName)) {
        for (let i = 0; i < ignoredFields[operationName as keyof typeof ignoredFields].length; i++) {
            // Not using hard copy as the request is useless in this step (response are to send)
            delete dataObj[ignoredFields[operationName as keyof typeof ignoredFields][i]];
        }
    }
    return dataObj;
}

export const logPlugin = Object.freeze(new LogPlugin());
