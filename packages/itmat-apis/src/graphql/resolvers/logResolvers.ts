import { enumEventStatus, enumEventType, enumUserTypes } from '@itmat-broker/itmat-types';
import { DMPResolversMap } from './context';
import { LogCore } from '@itmat-broker/itmat-cores';

export class LogResolvers {
    logCore: LogCore;
    constructor(logCore: LogCore) {
        this.logCore = logCore;
    }

    async getLogs(_parent, args: { requesterName: string, requesterType: enumUserTypes, logType?: enumEventType, actionType?: string, status?: enumEventStatus }, context) {
        const response = await this.logCore.getLogs(context.req.user, args.requesterName, args.logType ? [args.logType] : undefined, undefined, args.actionType ? [args.actionType] : undefined, args.status ? [args.status] : undefined);
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

    getResolvers(): DMPResolversMap {
        return {
            Query: {
                getLogs: this.getLogs.bind(this)
            }
        };
    }
}

