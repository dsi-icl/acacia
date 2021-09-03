import { db } from '../database/database';
import { v4 as uuid} from 'uuid';
import { LOG_TYPE, LOG_ACTION, LOG_STATUS, userTypes } from 'itmat-commons';

// only requests in white list will be recorded
export const logActionRecordWhiteList = Object.keys(LOG_ACTION);

// only requests in white list will be recorded
export const logActionShowWhiteList = Object.keys(LOG_ACTION);


export class LogPlugin {
    public async serverWillStartLogPlugin(): Promise<null> {
        await db.collections!.log_collection.insertOne({
            id: uuid(),
            requesterName: userTypes.SYSTEM,
            requesterType: userTypes.SYSTEM,
            logType: LOG_TYPE.SYSTEM_LOG,
            actionType: LOG_ACTION.startSERVER,
            actionData: JSON.stringify({}),
            time: Date.now(),
            status: LOG_STATUS.SUCCESS,
            error: ''
        });
        return null;
    }

    public async requestDidStartLogPlugin(requestContext: any): Promise<null> {
        if (!logActionRecordWhiteList.includes(requestContext.operationName)) {
            return null;
        }
        await db.collections!.log_collection.insertOne({
            id: uuid(),
            requesterName: requestContext.context.req.user ? requestContext.context.req.user.username : 'NA',
            requesterType: requestContext.context.req.user ? requestContext.context.req.user.type : userTypes.SYSTEM,
            logType: LOG_TYPE.REQUEST_LOG,
            actionType: LOG_ACTION[requestContext.operationName],
            actionData: JSON.stringify(requestContext.request.variables),
            time: Date.now(),
            status: requestContext.errors === undefined ? LOG_STATUS.SUCCESS : LOG_STATUS.FAIL,
            error: requestContext.errors === undefined ? '' : requestContext.errors[0].message
        });
        return null;
    }
}

export const logPlugin = Object.freeze(new LogPlugin());
