import { db } from '../../database/database';
import { ILogEntry, IUser, LOG_ACTION, userTypes } from '@itmat-broker/itmat-types';
import { ApolloError } from 'apollo-server-errors';
import { errorCodes } from '../errors';

export const logResolvers = {
    Query: {
        getLogs: async (__unused_parent: Record<string, unknown>, args: any, context: any): Promise<ILogEntry[]> => {
            const requester: IUser = context.req.user;

            /* only admin can access this field */
            if (requester.type !== userTypes.ADMIN) {
                throw new ApolloError(errorCodes.NO_PERMISSION_ERROR);
            }

            const queryObj: Record<string, any> = {};
            for (const prop in args) {
                if (args.prop !== undefined) {
                    queryObj[prop] = args.prop;
                }
            }
            const logData = await db.collections!.log_collection.find<ILogEntry>(queryObj, { projection: { _id: 0 } }).limit(1000).sort('time', -1).toArray();
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

async function logDecorationHelper(actionData: any, actionType: string) {
    const obj = JSON.parse(actionData) ?? {};
    if (Object.keys(hiddenFields).includes(actionType)) {
        for (let i = 0; i < hiddenFields[actionType as keyof typeof hiddenFields].length; i++) {
            delete obj[hiddenFields[actionType as keyof typeof hiddenFields][i]];
        }
    }
    if (actionType === LOG_ACTION.getStudy) {
        const studyId = obj['studyId'];
        const study = await db.collections!.studies_collection.findOne({ id: studyId, deleted: null })!;
        if (study === null || study === undefined) {
            obj['name'] = '';
        }
        else {
            obj['name'] = study.name;
        }
    }
    return obj;
}
