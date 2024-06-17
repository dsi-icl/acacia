import { dataRouter } from './dataProcedure';
import { driveRouter } from './driveProcedure';
import { studyRouter } from './studyProcedure';
import { router } from './trpc';
import { userRouter } from './userProcedure';

export const tRPCRouter = router({
    user: userRouter,
    drive: driveRouter,
    study: studyRouter,
    data: dataRouter
});

export type APPTRPCRouter = typeof tRPCRouter;