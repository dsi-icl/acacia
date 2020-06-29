import bcrypt from 'bcrypt';
import { db } from '../../database/database';
import config from '../../utils/configManager';
import { ApolloError } from 'apollo-server-core';
import { IUser, IUserWithoutToken, userTypes, Models } from 'itmat-commons';
import { v4 as uuid } from 'uuid';
import { errorCodes } from '../errors';
import { ILogEntry, LOG_ACTION } from 'itmat-commons'

export class LogCore {

    public async writeLog(requesterId: string, requesterName: string, requesterType: userTypes, action: LOG_ACTION, actionData: any): Promise<ILogEntry> {
        
        const log: ILogEntry = {
            id: uuid(),
            requesterId: requesterId,
            requesterName: requesterName,
            requesterType: requesterType,
            action: action,
            actionData: actionData,
            time: Date.now()
        }

        await db.collections!.log_collection.insertOne(log);
        return log;
    }

    public async getLogs(requesterId: string | null, requesterName: string | null, requesterType: userTypes | null, action: LOG_ACTION | null): Promise<ILogEntry[]> {
        const queryObj = {
            requesterId: requesterId,
            requesterName: requesterName,
            requesterType: requesterType,
            action: action
        };
        const cursor = db.collections!.log_collection.find(queryObj, { projection: {_id: 0}});
        return cursor.toArray();

    }
    
}

export const logCore = Object.freeze(new LogCore());