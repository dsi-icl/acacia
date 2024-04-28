import { db } from '../../database/database';
import { ILogEntry, LOG_ACTION, LOG_STATUS, LOG_TYPE, userTypes } from '@itmat-broker/itmat-types';
import { GraphQLError } from 'graphql';
import { errorCodes } from '../errors';
import { DMPResolversMap } from './context';
import { Filter } from 'mongodb';

export const logResolvers: DMPResolversMap = {
    Query: {
        getLogs: async (parent, args: { requesterName: string, requesterType: userTypes, logType: LOG_TYPE, actionType: LOG_ACTION, status: LOG_STATUS }, context) => {
            const requester = context.req.user;
            if (!requester) {
                throw new GraphQLError(errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);
            }
            /* only admin can access this field */
            if (!(requester.type === userTypes.ADMIN) && !(requester.metadata?.logPermission === true)) {
                throw new GraphQLError(errorCodes.NO_PERMISSION_ERROR);
            }

            const queryObj: Filter<ILogEntry> = {};
            for (const prop in args) {
                if (args[prop] !== undefined) {
                    queryObj[prop] = args[prop];
                }
            }
            const logData = await db.collections.log_collection.find<ILogEntry>(queryObj, { projection: { _id: 0 } }).limit(1000).sort('time', -1).toArray();
            // log information decoration
            for (const i in logData) {
                logData[i].actionData = JSON.stringify(await logDecorationHelper(logData[i].actionData, logData[i].actionType));
            }

            return logData;
        }
    }
};

// fields that carry sensitive information will be hidden
export const hiddenFields = {
    LOGIN_USER: ['password', 'totp'],
    UPLOAD_FILE: ['file', 'description']
};

async function logDecorationHelper(actionData: string, actionType: string) {
    const obj = JSON.parse(actionData) ?? {};
    if (Object.keys(hiddenFields).includes(actionType)) {
        for (let i = 0; i < hiddenFields[actionType as keyof typeof hiddenFields].length; i++) {
            delete obj[hiddenFields[actionType as keyof typeof hiddenFields][i]];
        }
    }
    if (actionType === LOG_ACTION.getStudy) {
        const studyId = obj['studyId'];
        const study = await db.collections.studies_collection.findOne({ id: studyId, deleted: null });
        if (study === null || study === undefined) {
            obj['name'] = '';
        }
        else {
            obj['name'] = study.name;
        }
    }
    return obj;
}
