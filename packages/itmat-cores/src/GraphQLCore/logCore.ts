import { ILog, IUserWithoutToken, enumEventStatus, enumEventType, enumUserTypes } from '@itmat-broker/itmat-types';
import { DBType } from '../database/database';
import { GraphQLError } from 'graphql';
import { errorCodes } from '../utils/errors';
import { Filter } from 'mongodb';

// the GraphQL log APIs will be removed in further development
export class LogCore {
    db: DBType;
    constructor(db: DBType) {
        this.db = db;
    }

    static readonly hiddenFields = {
        LOGIN_USER: ['password', 'totp'],
        UPLOAD_FILE: ['file', 'description']
    };

    public async getLogs(requester: IUserWithoutToken | undefined, requesterName?: string, requesterType?: enumUserTypes, logType?: enumEventType, actionType?: string, status?: enumEventStatus) {
        if (!requester) {
            throw new GraphQLError(errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);
        }
        /* only admin can access this field */
        if (!(requester.type === enumUserTypes.ADMIN) && !(requester.metadata?.['logPermission'] === true)) {
            throw new GraphQLError(errorCodes.NO_PERMISSION_ERROR);
        }

        const queryObj: Filter<ILog> = {};
        if (requesterName) { queryObj.requester = requesterName; }
        if (logType) { queryObj.type = logType; }
        if (actionType) { queryObj.event = actionType; }
        if (status) { queryObj.status = status; }

        const logData = await this.db.collections.log_collection.find(queryObj, { projection: { _id: 0 } }).limit(1000).sort('life.createdTime', -1).toArray();
        // log information decoration
        for (const i in logData) {
            logData[i].parameters = await this.logDecorationHelper(logData[i].parameters ?? {}, logData[i].event);
        }
        return logData.map((log) => {
            return {
                id: log.id,
                requesterName: log.requester,
                requesterType: requester.type,
                userAgent: 'MOZILLA',
                logType: log.type,
                actionType: log.event,
                actionData: JSON.stringify(log.parameters),
                time: log.life.createdTime,
                status: log.status,
                error: log.errors
            };
        });
        return logData;
    }

    public async logDecorationHelper(actionData: Record<string, unknown>, actionType: string) {
        const obj = { ...actionData };
        if (Object.keys(LogCore.hiddenFields).includes(actionType)) {
            for (let i = 0; i < LogCore.hiddenFields[actionType as keyof typeof LogCore.hiddenFields].length; i++) {
                delete obj[LogCore.hiddenFields[actionType as keyof typeof LogCore.hiddenFields][i]];
            }
        }
        if (actionType === 'getStudy') {
            const studyId = obj['studyId'] ?? '';
            const study = await this.db.collections.studies_collection.findOne({ 'id': studyId, 'life.deletedTime': null });
            if (study === null || study === undefined) {
                obj['name'] = '';
            }
            else {
                obj['name'] = study.name;
            }
        }
        return obj;
    }

}
