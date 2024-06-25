import { v4 as uuid } from 'uuid';
import { enumAPIResolver, enumEventStatus, enumEventType, enumReservedUsers } from '@itmat-broker/itmat-types';
import { GraphQLRequestContextWillSendResponse } from '@apollo/server';
import { ApolloServerContext } from '../utils/ApolloServerContext';
import { DBType } from '../database/database';

export class LogPlugin {
    db: DBType;
    constructor(db: DBType) {
        this.db = db;
    }

    public async serverWillStartLogPlugin() {
        await this.db.collections.log_collection.insertOne({
            id: uuid(),
            requester: enumReservedUsers.SYSTEM,
            type: enumEventType.SYSTEM_LOG,
            apiResolver: null,
            event: 'SERVER_START',
            parameters: undefined,
            status: enumEventStatus.SUCCESS,
            errors: undefined,
            timeConsumed: null,
            life: {
                createdTime: Date.now(),
                createdUser: enumReservedUsers.SYSTEM,
                deletedTime: null,
                deletedUser: null
            },
            metadata: {}
        });
        return;
    }

    public async requestDidStartLogPlugin(requestContext: GraphQLRequestContextWillSendResponse<ApolloServerContext>, startTime: number, executionTime: number) {
        if (!requestContext.operationName) {
            return;
        }

        const variables = requestContext.request.variables ?? {}; // Add null check
        await this.db.collections.log_collection.insertOne({
            id: uuid(),
            requester: requestContext.contextValue?.req?.user?.username ?? 'NA',
            type: enumEventType.API_LOG,
            apiResolver: enumAPIResolver.GraphQL,
            event: requestContext.operationName,
            parameters: ignoreFieldsHelper(variables, requestContext.operationName),
            status: requestContext.errors === undefined ? enumEventStatus.SUCCESS : enumEventStatus.FAIL,
            errors: requestContext.errors === undefined ? undefined : requestContext.errors[0].message,
            timeConsumed: executionTime,
            life: {
                createdTime: Date.now(),
                createdUser: 'SYSTEMAGENT',
                deletedTime: null,
                deletedUser: null
            },
            metadata: {
                startTime: startTime,
                endTime: startTime + executionTime
            }
        });
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
    return dataObj as Record<string, unknown>;
}