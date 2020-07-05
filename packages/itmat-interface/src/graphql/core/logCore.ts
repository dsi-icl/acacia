import { db } from '../../database/database';
import { v4 as uuid } from 'uuid';
import { ILogEntry, LOG_ACTION, LOG_STATUS, userTypes } from 'itmat-commons';

export class LogCore {
    public async writeLog(requesterId: string, requesterName: string, requesterType: userTypes, action: LOG_ACTION, actionData: any, status: LOG_STATUS): Promise<ILogEntry> {
        const log: ILogEntry = {
            id: uuid(),
            requesterId: requesterId,
            requesterName: requesterName,
            requesterType: requesterType,
            action: action,
            actionData: actionData,
            time: Date.now(),
            status: status
        };
        await db.collections!.log_collection.insertOne(log);
        return log;
    }
}

export const logCore = Object.freeze(new LogCore());
