import { enumEventStatus, enumEventType, enumUserTypes } from '@itmat-broker/itmat-types';
import { DMPResolversMap } from './context';
import { db } from '../../database/database';
import { LogCore } from '@itmat-broker/itmat-cores';

const logCore = Object.freeze(new LogCore(db));

export const logResolvers: DMPResolversMap = {
    Query: {
        // keep this api temporarily for testing purpose
        // should be removed in further development
        getLogs: async (_parent, args: { requesterName: string, requesterType: enumUserTypes, logType: enumEventType, actionType: string, status: enumEventStatus }, context) => {
            return await logCore.getLogs(context.req.user, args.requesterName, args.requesterType, args.logType, args.actionType, args.status);
        }
    }
};



