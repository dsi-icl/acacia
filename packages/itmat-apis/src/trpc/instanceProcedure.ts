import { z } from 'zod';
import { TRPCBaseProcedure, TRPCRouter } from './trpc';
import { InstanceCore } from '@itmat-broker/itmat-cores';
import { enumAppType, enumInstanceStatus, LXDInstanceTypeEnum, CoreError, enumCoreErrors, enumOpeType, enumUserTypes} from '@itmat-broker/itmat-types';

export class InstanceRouter {
    baseProcedure: TRPCBaseProcedure;
    router: TRPCRouter;
    instanceCore: InstanceCore;

    constructor(baseProcedure: TRPCBaseProcedure, router: TRPCRouter, instanceCore: InstanceCore) {
        this.baseProcedure = baseProcedure;
        this.router = router;
        this.instanceCore = instanceCore;
    }

    _router() {
        return this.router({
            /**
             * Create an instance
             */
            createInstance: this.baseProcedure.input(
                z.object({
                    name: z.string(),
                    type: z.nativeEnum(LXDInstanceTypeEnum),
                    appType: z.nativeEnum(enumAppType),
                    lifeSpan: z.number(),
                    cpuLimit: z.number().optional(),
                    memoryLimit: z.string().optional(),
                    diskLimit: z.string().optional()
                })
            ).mutation(async ({ input, ctx }) => {

                if (!ctx.req.user || !ctx.req.user.id) {
                    throw new CoreError(
                        enumCoreErrors.NOT_LOGGED_IN,
                        'User must be authenticated.');
                }
                const userId = ctx.req.user.id;

                // Check if requested resources exceed the user's quota
                await this.instanceCore.checkQuotaBeforeCreation(userId, input.cpuLimit ?? 0, input.memoryLimit ?? '0', input.diskLimit ?? '0', 1);


                return await this.instanceCore.createInstance(
                    userId,
                    ctx.req.user.username,
                    input.name,
                    input.type,
                    input.appType,
                    input.lifeSpan,
                    input.cpuLimit,
                    input.memoryLimit,
                    input.diskLimit
                );
            }),

            /**
             * Start or stop an instance
             */
            startStopInstance: this.baseProcedure.input(
                z.object({
                    instanceId: z.string(),
                    action: z.enum([enumOpeType.START, enumOpeType.STOP])
                })
            ).mutation(async ({ input, ctx }) => {
                if (!ctx.req.user || !ctx.req.user.id) {
                    throw new CoreError(enumCoreErrors.NOT_LOGGED_IN, 'User must be authenticated.');
                }
                const userId = ctx.req.user.id;

                return await this.instanceCore.startStopInstance(userId, input.instanceId, input.action);
            }),

            /**
             * Restart an instance with a new lifespan
             */
            restartInstance: this.baseProcedure.input(
                z.object({
                    instanceId: z.string(),
                    lifeSpan: z.number()
                })
            ).mutation(async ({ input, ctx }) => {
                if (!ctx.req.user || !ctx.req.user.id) {
                    throw new CoreError(enumCoreErrors.NOT_LOGGED_IN, 'User must be authenticated.');
                }
                const userId = ctx.req.user.id;

                return await this.instanceCore.restartInstance(userId, input.instanceId, input.lifeSpan);
            }),

            /**
             * Get all instances for an user
             */
            getInstances: this.baseProcedure.query(async ({ ctx }) => {
                const user = ctx.req.user;
                if (!user) {
                    throw new CoreError(
                        enumCoreErrors.NO_PERMISSION_ERROR,
                        'Insufficient permissions.'
                    );
                }
                return await this.instanceCore.getInstances(user.id);
            }),

            /**
             * Edit an instance
             */
            editInstance: this.baseProcedure.input(
                z.object({
                    instanceId: z.string().optional(),
                    instanceName: z.string().optional(),
                    // set the update to the type LxdConfiguration
                    updates: z.object({
                        name: z.string().optional(),
                        type: z.nativeEnum(LXDInstanceTypeEnum).optional(),
                        appType: z.nativeEnum(enumAppType).optional(),
                        lifeSpan: z.number().optional(),
                        project: z.string().optional(),
                        status: z.nativeEnum(enumInstanceStatus).optional(),
                        cpuLimit: z.number().optional(),
                        memoryLimit: z.string().optional()
                    }).passthrough()
                })
            ).mutation(async ({ input, ctx }) => {
                if (!ctx.req.user || !ctx.req.user.id) {
                    throw new CoreError(enumCoreErrors.NOT_LOGGED_IN, 'User must be authenticated.');
                }

                return await this.instanceCore.editInstance(ctx.req.user, input.instanceId, input.instanceName, input.updates);
            }),

            /**
             * Delete an instance
             */
            deleteInstance: this.baseProcedure.input(
                z.object({
                    instanceId: z.string()
                })
            ).mutation(async ({ input, ctx }) => {
                const user = ctx.req.user;
                const instance = await this.instanceCore.getInstanceById(input.instanceId);
                if (user.type !==  enumUserTypes.ADMIN || user.id !== instance.userId) {
                    throw new CoreError(
                        enumCoreErrors.NO_PERMISSION_ERROR,
                        'Insufficient permissions.'
                    );
                }

                return await this.instanceCore.deleteInstance(user.id, input.instanceId);
            }),
            getQuotaAndFlavors: this.baseProcedure.query(async ({ ctx }) => {
                if (!ctx.req.user || !ctx.req.user.id) {
                    throw new CoreError(enumCoreErrors.NOT_LOGGED_IN, 'User must be authenticated.');
                }
                return await this.instanceCore.getQuotaAndFlavors(ctx.req.user);
            })
        });
    }
}
