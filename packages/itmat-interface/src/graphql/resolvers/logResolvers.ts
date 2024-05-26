import { LOG_ACTION, LOG_STATUS, LOG_TYPE, enumUserTypes } from '@itmat-broker/itmat-types';
import { DMPResolversMap } from './context';
import { db } from '../../database/database';
import { LogCore } from '@itmat-broker/itmat-cores';

const logCore = Object.freeze(new LogCore(db));

export const logResolvers: DMPResolversMap = {
    Query: {
        getLogs: async (_parent, args: { requesterName: string, requesterType: enumUserTypes, logType: LOG_TYPE, actionType: LOG_ACTION, status: LOG_STATUS }, context) => {
            return await logCore.getLogs(context.req.user, args.requesterName, args.requesterType, args.logType, args.actionType, args.status);
        }
    }
};



