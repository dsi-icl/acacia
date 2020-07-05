import { db } from '../../database/database';
import { logCore } from '../core/logCore';
import { LOG_ACTION, ILogEntry, userTypes, LOG_STATUS, Models } from 'itmat-commons';
import { ApolloError } from 'apollo-server-errors';
import { errorCodes } from '../errors';

export const logResolvers = {
    Mutation: {
        writeLog: async (__unused_parent: Record<string, unknown>, {requesterId, requesterName, requesterType, action, actionData, status}: {requesterId: string, requesterName: string, requesterType: userTypes, action: LOG_ACTION, actionData: JSON, status: LOG_STATUS}): Promise<ILogEntry> => {
            const writtenLog = await logCore.writeLog(
                requesterId,
                requesterName,
                requesterType,
                action,
                actionData,
                status
            );
            return writtenLog;
        }
    },

    Query: {
        getLogs: async (__unused_parent: Record<string, unknown>, args: any, context: any): Promise<ILogEntry[]> => {
            const requester: Models.UserModels.IUser = context.req.user;

            /* only admin can access this field */
            if (requester.type !== userTypes.ADMIN) {
                throw new ApolloError(errorCodes.NO_PERMISSION_ERROR);
            }

            const queryObj = {};
            for (const prop in args) {
                if (args.prop !== undefined) {
                    queryObj[prop] = args.prop;
                }
            }
            const cursor = db.collections!.log_collection.find(queryObj, { projection: {_id: 0}}).sort('time', -1);
            return cursor.toArray();
        }
    }
};
