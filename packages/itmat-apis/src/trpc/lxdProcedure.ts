import { z } from 'zod';
import { TRPCBaseProcedure, TRPCRouter } from './trpc';
import {LxdManager} from '@itmat-broker/itmat-cores';
import { CoreError, enumCoreErrors , LXDInstanceTypeEnum} from '@itmat-broker/itmat-types';

export class LXDRouter {
    baseProcedure: TRPCBaseProcedure;
    router: TRPCRouter;
    lxdManager: LxdManager;


    constructor(baseProcedure: TRPCBaseProcedure, router: TRPCRouter, lxdManager: LxdManager) {
        this.baseProcedure = baseProcedure;
        this.router = router;
        this.lxdManager = lxdManager;
    }

    _router() {
        return this.router({
            getResources: this.baseProcedure.query(async ({ctx }) => {
                if (!ctx.req?.user) {
                    throw new CoreError(enumCoreErrors.AUTHENTICATION_ERROR, 'User must be authenticated.');
                }
                return await this.lxdManager.getResources();
            }),

            getInstances: this.baseProcedure.query(async ({ctx }) => {
                if (!ctx.req?.user) {
                    throw new CoreError(enumCoreErrors.AUTHENTICATION_ERROR, 'User must be authenticated.');
                }
                return await this.lxdManager.getInstances();
            }),

            getInstanceState: this.baseProcedure.input(z.object({
                container: z.string(),
                project: z.string()
            })).query(async ({ input, ctx }) => {
                if (!ctx.req?.user) {
                    throw new CoreError(enumCoreErrors.AUTHENTICATION_ERROR, 'User must be authenticated.');
                }
                return await this.lxdManager.getInstanceState(input.container, input.project);
            }),

            getOperations: this.baseProcedure.input(z.object({})).query(async ({ ctx }) => {
                if (!ctx.req?.user) {
                    throw new CoreError(enumCoreErrors.AUTHENTICATION_ERROR, 'User must be authenticated.');
                }
                return await this.lxdManager.getOperations();
            }),

            getOperationStatus: this.baseProcedure.input(z.object({
                operationId: z.string()
            })).query(async ({ input, ctx }) => {
                if (!ctx.req?.user) {
                    throw new CoreError(enumCoreErrors.AUTHENTICATION_ERROR, 'User must be authenticated.');
                }
                return await this.lxdManager.getOperationStatus(`/1.0/operations/${input.operationId}`);
            }),

            getInstanceConsole: this.baseProcedure.input(z.object({
                container: z.string(),
                options: z.object({
                    height: z.number(),
                    width: z.number(),
                    type: z.string()
                })
            })).mutation(async ({ input, ctx }) => {
                if (!ctx.req?.user) {
                    throw new CoreError(enumCoreErrors.AUTHENTICATION_ERROR, 'User must be authenticated.');
                }
                return await this.lxdManager.getInstanceConsole(input.container, input.options);
            }),

            getInstanceConsoleLog: this.baseProcedure.input(z.object({
                container: z.string()
            })).mutation(async ({ input, ctx }) => {
                if (!ctx.req?.user) {
                    throw new CoreError(enumCoreErrors.AUTHENTICATION_ERROR, 'User must be authenticated.');
                }
                return await this.lxdManager.getInstanceConsoleLog(input.container);
            }),

            createInstance: this.baseProcedure.input(z.object({
                // set the config to LxdConfiguration
                name: z.string(),
                architecture: z.literal('x86_64'),
                config: z.object({
                    'limits.cpu': z.string(),
                    'limits.memory': z.string(),
                    'user.username': z.string(),
                    'user.user-data': z.string()
                }),
                source: z.object({
                    type: z.string(),
                    alias: z.string()
                }),
                profiles: z.array(z.string()),
                // use LXDInstanceTypeEnum
                type: z.nativeEnum(LXDInstanceTypeEnum),
                project: z.string()
            })).mutation(async ({ input, ctx }) => {
                if (!ctx.req?.user) {
                    throw new CoreError(enumCoreErrors.AUTHENTICATION_ERROR, 'User must be authenticated.');
                }
                return await this.lxdManager.createInstance({
                    name: input.name,
                    architecture: input.architecture,
                    config: input.config,
                    source: input.source,
                    profiles: input.profiles,
                    type: input.type
                }
                , input.project);
            }),

            updateInstance: this.baseProcedure.input(z.object({
                instanceName: z.string(),
                payload: z.any(),
                project: z.string()
            })).mutation(async ({ input, ctx }) => {
                if (!ctx.req?.user) {
                    throw new CoreError(enumCoreErrors.AUTHENTICATION_ERROR, 'User must be authenticated.');
                }
                return await this.lxdManager.updateInstance(input.instanceName, input.payload, input.project);
            }),

            startStopInstance: this.baseProcedure.input(z.object({
                instanceName: z.string(),
                action: z.enum(['start', 'stop']),
                project: z.string()
            })).mutation(async ({ input, ctx }) => {
                if (!ctx.req?.user) {
                    throw new CoreError(enumCoreErrors.AUTHENTICATION_ERROR, 'User must be authenticated.');
                }
                return await this.lxdManager.startStopInstance(input.instanceName, input.action, input.project);
            }),

            deleteInstance: this.baseProcedure.input(z.object({
                instanceName: z.string(),
                project: z.string()
            })).mutation(async ({ input, ctx }) => {
                if (!ctx.req?.user) {
                    throw new CoreError(enumCoreErrors.AUTHENTICATION_ERROR, 'User must be authenticated.');
                }
                return await this.lxdManager.deleteInstance(input.instanceName, input.project);
            })
        });
    }
}