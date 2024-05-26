import { router } from './trpc';
import { userRouter } from './userProcedure';

export const tRPCRouter = router({
    user: userRouter
});

export type APPTRPCRouter = typeof tRPCRouter;