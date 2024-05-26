import { ILogEntry, IUserWithoutToken, LOG_ACTION, LOG_STATUS, LOG_TYPE, enumUserTypes } from '@itmat-broker/itmat-types';
import { DBType } from '../database/database';
import { GraphQLError } from 'graphql';
import { errorCodes } from '../utils/errors';
import { Filter } from 'mongodb';

export class LogCore {
    db: DBType;
    constructor(db: DBType) {
        this.db = db;
    }

    static readonly hiddenFields = {
        LOGIN_USER: ['password', 'totp'],
        UPLOAD_FILE: ['file', 'description']
    };

    public async getLogs(requester: IUserWithoutToken | undefined, requesterName?: string, requesterType?: enumUserTypes, logType?: LOG_TYPE, actionType?: LOG_ACTION, status?: LOG_STATUS) {
        if (!requester) {
            throw new GraphQLError(errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);
        }
        /* only admin can access this field */
        if (!(requester.type === enumUserTypes.ADMIN) && !(requester.metadata?.['logPermission'] === true)) {
            throw new GraphQLError(errorCodes.NO_PERMISSION_ERROR);
        }

        const queryObj: Filter<ILogEntry> = {};
        if (requesterName) { queryObj.requesterName = requesterName; }
        if (requesterType) { queryObj.requesterType = requesterType; }
        if (logType) { queryObj.logType = logType; }
        if (actionType) { queryObj.actionType = actionType; }
        if (status) { queryObj.status = status; }

        const logData = await this.db.collections.log_collection.find<ILogEntry>(queryObj, { projection: { _id: 0 } }).limit(1000).sort('time', -1).toArray();
        // log information decoration
        for (const i in logData) {
            logData[i].actionData = JSON.stringify(await this.logDecorationHelper(logData[i].actionData, logData[i].actionType));
        }

        return logData;
    }

    public async logDecorationHelper(actionData: string, actionType: string) {
        const obj = JSON.parse(actionData) ?? {};
        if (Object.keys(LogCore.hiddenFields).includes(actionType)) {
            for (let i = 0; i < LogCore.hiddenFields[actionType as keyof typeof LogCore.hiddenFields].length; i++) {
                delete obj[LogCore.hiddenFields[actionType as keyof typeof LogCore.hiddenFields][i]];
            }
        }
        if (actionType === LOG_ACTION.getStudy) {
            const studyId = obj['studyId'];
            const study = await this.db.collections.studies_collection.findOne({ id: studyId, deleted: null });
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
