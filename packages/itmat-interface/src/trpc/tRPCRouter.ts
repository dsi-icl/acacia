import { driveRouter } from './driveProcedure';
import { router } from './trpc';
import { userRouter } from './userProcedure';

export const tRPCRouter = router({
    user: userRouter,
    drive: driveRouter
});

export type APPTRPCRouter = typeof tRPCRouter;