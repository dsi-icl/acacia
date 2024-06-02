import { inferAsyncReturnType, initTRPC } from '@trpc/server';
import type { CreateNextContextOptions } from '@trpc/server/adapters/next';
import { PassThrough } from 'stream';

export const createtRPCContext = async (opts: CreateNextContextOptions) => {
    const file = opts.req.file;
    let fileStream;

    if (file) {
        fileStream = new PassThrough();
        fileStream.end(file.buffer);
    }
    return {
        user: opts.req.user,
        req: opts.req,
        res: opts.res,
        file: file ? {
            createReadStream: () => fileStream,
            filename: file.originalname,
            mimetype: file.mimetype,
            encoding: file.encoding
        } : null
    };
};

type Context = inferAsyncReturnType<typeof createtRPCContext>;
const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

export const baseProcedure = t.procedure.use(async (opts) => {
    // Move on to the next middleware or procedure
    return opts.next(opts);
});