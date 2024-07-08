import { enumEventStatus, enumEventType, enumUserTypes } from '@itmat-broker/itmat-types';
import { DMPResolversMap } from './context';
import { db } from '../../database/database';
import { TRPCLogCore } from '@itmat-broker/itmat-cores';

const logCore = new TRPCLogCore(db);

export const logResolvers: DMPResolversMap = {
    Query: {
        // keep this api temporarily for testing purpose
        // should be removed in further development
        getLogs: async (_parent, args: { requesterName: string, requesterType: enumUserTypes, logType?: enumEventType, actionType?: string, status?: enumEventStatus }, context) => {
            const response = await logCore.getLogs(context.req.user, args.requesterName, args.logType ? [args.logType] : undefined, undefined, args.actionType ? [args.actionType] : undefined, args.status ? [args.status] : undefined);
            return response.map(el => {
                return {
                    ...el,
                    requesterName: el.requester,
                    requesterType: undefined,
                    userAgent: 'N/A',
                    logType: el.type,
                    actionType: el.event,
                    actionData: el.parameters,
                    time: el.life.createdTime,
                    status: el.status,
                    error: el.errors
                };
            });
        }
    }
};



