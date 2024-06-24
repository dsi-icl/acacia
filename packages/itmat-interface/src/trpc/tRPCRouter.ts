import { configRouter } from './configProcedure';
import { dataRouter } from './dataProcedure';
import { driveRouter } from './driveProcedure';
import { roleRouter } from './roleProcedure';
import { studyRouter } from './studyProcedure';
import { router } from './trpc';
import { userRouter } from './userProcedure';

export const tRPCRouter = router({
    user: userRouter,
    drive: driveRouter,
    study: studyRouter,
    data: dataRouter,
    role: roleRouter,
    config: configRouter
});

export type APPTRPCRouter = typeof tRPCRouter;