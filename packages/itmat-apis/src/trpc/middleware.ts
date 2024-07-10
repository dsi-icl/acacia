import { enumAPIResolver, enumEventStatus, enumEventType } from '@itmat-broker/itmat-types';
import { v4 as uuid } from 'uuid';

function parseRequestinput(url: string) {
    const [apiCall, queryString] = url.slice(1).split('?');
    let apiParams: { [key: string]: unknown } = {};
    if (queryString) {
        const inputParam = (new URLSearchParams(queryString ?? {})).get('input') ?? '';
        apiParams = JSON.parse(decodeURIComponent(inputParam));
    }
    return { apiCall, apiParams };

}


export const tRPCBaseProcedureMilldeware = (async (db, opts) => {
    const startTime = Date.now();

    const result = await opts.next();

    const executionTime = Date.now() - startTime;
    const { apiCall, apiParams } = parseRequestinput(opts.ctx.req.url);

    let errorMessage: string | undefined = undefined;

    if ('error' in result) {
        errorMessage = result.error.message;
    }

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
