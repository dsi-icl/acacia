import { enumAPIResolver, enumEventStatus, enumEventType } from '@itmat-broker/itmat-types';
import { z } from 'zod';
import { TRPCLogCore } from '@itmat-broker/itmat-cores';
import { TRPCBaseProcedure, TRPCRouter } from './trpc';


export class LogRouter {
    baseProcedure: TRPCBaseProcedure;
    router: TRPCRouter;
    logCore: TRPCLogCore;
    constructor(baseProcedure: TRPCBaseProcedure, router: TRPCRouter, logCore: TRPCLogCore) {
        this.baseProcedure = baseProcedure;
        this.router = router;
        this.logCore = logCore;
    }

    _router() {
        return this.router({
            /**
             * Get the list of logs.
             *
             * @param caller - The caller of the event.
             * @param type - The type of the event.
             * @param apiResolver - The resolver of the event.
             * @param event - The event.
             * @param status - The status of the event.
             * @param range - The range of the indexes.
             *
             * @return IOrganisation[] - The list of objects of IOrganisation.
             */
            getLogs: this.baseProcedure.input(z.object({
                caller: z.optional(z.string()),
                type: z.optional(z.array(z.nativeEnum(enumEventType)), z.null()),
                apiResolver: z.optional(z.array(z.nativeEnum(enumAPIResolver)), z.null()),
                event: z.optional(z.array(z.string()), z.null()),
                status: z.optional(z.array(z.nativeEnum(enumEventStatus)), z.null()),
                indexRange: z.optional(z.array(z.number()), z.null()),
                timeRange: z.optional(z.array(z.number()), z.null())
            })).query(async (opts) => {
                return await this.logCore.getLogs(opts.ctx.req.user, opts.input.caller, opts.input.type, opts.input.apiResolver, opts.input.event, opts.input.status, opts.input.indexRange, opts.input.timeRange);
            }),
            /**
             * Get the summary of the logs.
             */
            getLogsSummary: this.baseProcedure.query(async () => {
                return await this.logCore.getLogsSummary();
            })
        });
    }
}