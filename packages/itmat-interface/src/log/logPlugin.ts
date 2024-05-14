import { db } from '../database/database';
import { v4 as uuid } from 'uuid';
import { LOG_TYPE, LOG_ACTION, LOG_STATUS, USER_AGENT, userTypes } from '@itmat-broker/itmat-types';
import { GraphQLRequestContextWillSendResponse } from '@apollo/server';
import { ApolloServerContext } from '../graphql/ApolloServerContext';

// only requests in white list will be recorded
export const logActionRecordWhiteList = Object.keys(LOG_ACTION);

// only requests in white list will be recorded
export const logActionShowWhiteList = Object.keys(LOG_ACTION);

export class LogPlugin {
    public async serverWillStartLogPlugin(): Promise<null> {
        await db.collections.log_collection.insertOne({
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

    public async requestDidStartLogPlugin(requestContext: GraphQLRequestContextWillSendResponse<ApolloServerContext>): Promise<null> {
        if (!requestContext.operationName || !logActionRecordWhiteList.includes(requestContext.operationName)) {
            return null;
        }
        if (LOG_ACTION[requestContext.operationName] === undefined || LOG_ACTION[requestContext.operationName] === null) {
            return null;
        }
        const variables = requestContext.request.variables ?? {}; // Add null check
        await db.collections.log_collection.insertOne({
            id: uuid(),
            requesterName: requestContext.contextValue?.req?.user?.username ?? 'NA',
            requesterType: requestContext.contextValue?.req?.user?.type ?? userTypes.SYSTEM,
            userAgent: (requestContext.contextValue.req?.headers['user-agent'] as string)?.startsWith('Mozilla') ? USER_AGENT.MOZILLA : USER_AGENT.OTHER,
            logType: LOG_TYPE.REQUEST_LOG,
            actionType: LOG_ACTION[requestContext.operationName],
            actionData: JSON.stringify(ignoreFieldsHelper(variables, requestContext.operationName)), // Use the null-checked variables
            time: Date.now(),
            status: requestContext.errors === undefined ? LOG_STATUS.SUCCESS : LOG_STATUS.FAIL,
            errors: requestContext.errors === undefined ? '' : requestContext.errors[0].message
        });
        return null;
    }
}

type LogOperationName = 'login' | 'createUser' | 'registerPubkey' | 'issueAccessToken' | 'editUser' | 'uploadDataInArray' | 'uploadFile' | string;

interface LoginData {
    passpord?: string;
    totp?: string;
}

interface CreateUserData {
    user?: {
        password?: string;
    };
}

interface registerPubkeyData {
    signature?: string;
}

interface EditUserData {
    user?: {
        password?: string;
    };
}

interface UploadDataInArrayData {
    data?: {
        value?: string;
        file?: string;
        metadata?: string;
    }[];
}

interface UploadFileData {
    file?: string;
}

type DataObj = LoginData | CreateUserData | registerPubkeyData | EditUserData | UploadDataInArrayData | UploadFileData;

function ignoreFieldsHelper(dataObj: DataObj, operationName: LogOperationName) {
    if (operationName === 'login') {
        delete dataObj['password'];
        delete dataObj['totp'];
    } else if (operationName === 'createUser') {
        delete dataObj['user']['password'];
    } else if (operationName === 'registerPubkey') {
        delete dataObj['signature'];
    } else if (operationName === 'issueAccessToken') {
        delete dataObj['signature'];
    } else if (operationName === 'editUser') {
        delete dataObj['user']['password'];
    } else if (operationName === 'uploadDataInArray') {
        if (Array.isArray(dataObj['data'])) {
            for (let i = 0; i < dataObj['data'].length; i++) {
                // only keep the fieldId
                delete dataObj['data'][i].value;
                delete dataObj['data'][i].file;
                delete dataObj['data'][i].metadata;
            }
        }
    } else if (operationName === 'uploadFile') {
        delete dataObj['file'];
    }
    return dataObj;
}

export const logPlugin = Object.freeze(new LogPlugin());
