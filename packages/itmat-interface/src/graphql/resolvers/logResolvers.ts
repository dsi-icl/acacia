import { ApolloError } from 'apollo-server-express';
import { v4 as uuid } from 'uuid';
import { db } from '../../database/database';
import { objStore } from '../../objStore/objStore';
import { logCore } from '../core/logCore';
import { errorCodes } from '../errors';
import { IGenericResponse, makeGenericReponse } from '../responses';
import { LOG_ACTION, ILogEntry, userTypes, Query} from 'itmat-commons';

export const logResolvers = {
    Mutation: {
        writeLog: async (__unused_parent: Record<string, unknown>, {requesterId, requesterName, requesterType, action, actionData}: {requesterId: string, requesterName: string, requesterType: userTypes, action: LOG_ACTION, actionData: JSON}): Promise<ILogEntry> => {
            const writtenLog = await logCore.writeLog(
                requesterId,
                requesterName,
                requesterType,
                action,
                actionData
            )
            return writtenLog;
        }
    },

    Query: {
        getLogs: async (__unused_parent: Record<string, unknown>, args: any): Promise<ILogEntry[]> => {
            const queryObj = {};
            for (let prop in args) {
                if (args.prop !== undefined) {
                    queryObj[prop] = args.prop;
                }
            }
            const cursor = db.collections!.log_collection.find(queryObj, { projection: {_id: 0}}).sort('time', -1);
            return cursor.toArray();
        }
    }
};