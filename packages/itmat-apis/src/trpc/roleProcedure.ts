import { z } from 'zod';
import { PermissionCore } from '@itmat-broker/itmat-cores';
import { enumStudyRoles } from '@itmat-broker/itmat-types';
import { TRPCBaseProcedure, TRPCRouter } from './trpc';

export class RoleRouter {
    baseProcedure: TRPCBaseProcedure;
    router: TRPCRouter;
    permissionCore: PermissionCore;
    constructor(baseProcedure: TRPCBaseProcedure, router: TRPCRouter, permissionCore: PermissionCore) {
        this.baseProcedure = baseProcedure;
        this.router = router;
        this.permissionCore = permissionCore;
    }

    _router() {
        return this.router({
            /**
             * Get the roles of a user.
             *
             * @param studyId - The id of the study.
             *
             * @returns IRole[]
             */
            getUserRoles: this.baseProcedure.input(z.object({
                userId: z.string(),
                studyId: z.optional(z.string())
            })).query(async (opts) => {
                return await this.permissionCore.getRolesOfUser(opts.ctx.user, opts.input.userId, opts.input.studyId);
            }),
            /**
             * Get the roles of a study.
             *
             * @param studyId - The id of the study.
             *
             * @returns IRole[]
             */
            getStudyRoles: this.baseProcedure.input(z.object({
                studyId: z.string()
            })).query(async (opts) => {
                return await this.permissionCore.getRolesOfStudy(opts.ctx.user, opts.input.studyId);
            }),
            /**
             * Create a new study role.
             *
             * @param studyId - The id of the study.
             * @param name - The name of the role.
             * @param description - The description of the role.
             * @param dataPermissions - The data permissions for the role.
             * @param studyRole - The role of the study.
             * @param users - The users of the role.
             *
             * @returns IRole
             */
            createStudyRole: this.baseProcedure.input(z.object({
                studyId: z.string(),
                name: z.string(),
                description: z.optional(z.string().optional()),
                dataPermissions: z.optional(z.array(z.object({
                    fields: z.array(z.string()),
                    dataProperties: z.record(z.array(z.string())),
                    includeUnVersioned: z.boolean(),
                    permission: z.number()
                }))),
                studyRole: z.optional(z.nativeEnum(enumStudyRoles)),
                users: z.optional(z.array(z.string()))
            })).mutation(async (opts) => {
                return await this.permissionCore.createStudyRole(
                    opts.ctx.user,
                    opts.input.studyId,
                    opts.input.name,
                    opts.input.description,
                    opts.input.dataPermissions,
                    opts.input.studyRole,
                    opts.input.users
                );
            }),
            /**
             * Edit a study role.
             *
             * @param roleId - The id of the role.
             * @param name - The name of the role.
             * @param description - The description of the role.
             * @param dataPermissions - The data permissions for the role.
             * @param studyRole - The role of the study.
             * @param users - The users of the role.
             *
             * @returns IRole
             */
            editStudyRole: this.baseProcedure.input(z.object({
                roleId: z.string(),
                name: z.optional(z.string()),
                description: z.optional(z.string().optional()),
                dataPermissions: z.optional(z.array(z.object({
                    fields: z.array(z.string()),
                    dataProperties: z.record(z.array(z.string())),
                    includeUnVersioned: z.boolean(),
                    permission: z.number()
                }))),
                studyRole: z.optional(z.nativeEnum(enumStudyRoles)),
                users: z.optional(z.array(z.string()))
            })).mutation(async (opts) => {
                return await this.permissionCore.editStudyRole(
                    opts.ctx.user,
                    opts.input.roleId,
                    opts.input.name,
                    opts.input.description,
                    opts.input.dataPermissions,
                    opts.input.studyRole,
                    opts.input.users
                );
            }),
            /**
             * Delete a study role.
             *
             * @param roleId - The id of the role.
             *
             * @returns IRole
             */
            deleteStudyRole: this.baseProcedure.input(z.object({
                roleId: z.string()
            })).mutation(async (opts) => {
                return await this.permissionCore.deleteStudyRole(opts.ctx.user, opts.input.roleId);
            })
        });
    }
}


