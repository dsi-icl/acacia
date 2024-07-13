import { inferAsyncReturnType, initTRPC } from '@trpc/server';
import type { CreateNextContextOptions } from '@trpc/server/adapters/next';
import { db } from '../database/database';
import { v4 as uuid } from 'uuid';
import { enumAPIResolver, enumEventStatus, enumEventType } from '@itmat-broker/itmat-types';

export const createtRPCContext = async (opts: CreateNextContextOptions) => {
    return {
        user: opts.req.user,
        req: opts.req,
        res: opts.res
    };
};

type Context = inferAsyncReturnType<typeof createtRPCContext>;
const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

export const baseProcedure = t.procedure.use(async (opts) => {
    const startTime = Date.now();

    const result = await opts.next();

    const executionTime = Date.now() - startTime;
    const { apiCall, apiParams } = parseRequestinput(opts.ctx.req.url);

    let errorMessage: string | undefined = undefined;

    if ('error' in result) {
        errorMessage = result.error.message;
    }

    // optional: log the response
    // if ('data' in result) {
    // }

    await db.collections.log_collection.insertOne({
        id: uuid(),
        requester: opts.ctx.req.user?.id ?? 'NA',
        type: enumEventType.API_LOG,
        apiResolver: enumAPIResolver.tRPC,
        event: apiCall,
        parameters: apiParams,
        status: errorMessage ? enumEventStatus.FAIL : enumEventStatus.SUCCESS,
        errors: errorMessage,
        timeConsumed: executionTime,
        life: {
            createdTime: Date.now(),
            createdUser: opts.ctx.req.user?.id ?? 'NA',
            deletedTime: null,
            deletedUser: null
        },
        metadata: {
            startTime: startTime,
            endTime: startTime + executionTime
        }
    });

    return result;
});

function parseRequestinput(url: string) {
    const [apiCall, queryString] = url.slice(1).split('?');
    let apiParams: { [key: string]: unknown } = {};
    if (queryString) {
        const inputParam = (new URLSearchParams(queryString ?? {})).get('input') ?? '';
        apiParams = JSON.parse(decodeURIComponent(inputParam));
    }
    return { apiCall, apiParams };

}