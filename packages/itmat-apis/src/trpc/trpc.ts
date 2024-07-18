import { inferAsyncReturnType, initTRPC } from '@trpc/server';
import type { CreateNextContextOptions } from '@trpc/server/adapters/next';

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

// export const baseProcedure = t.procedure.use(async (opts) => {
//     return await tRPCBaseProcedureMilldeware(opts.ctx.req.db, opts);
// });

export type TRPCBaseProcedure = typeof publicProcedure;
export type TRPCRouter = typeof router;
