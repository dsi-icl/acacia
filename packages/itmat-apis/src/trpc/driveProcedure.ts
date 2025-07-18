
import { FileUploadSchema, enumFileTypes } from '@itmat-broker/itmat-types';
import { DriveCore } from '@itmat-broker/itmat-cores';
import { z } from 'zod';
import { TRPCBaseProcedure, TRPCRouter } from './trpc';



export const ZDrivePermission = z.object({
    iid: z.string(),
    read: z.boolean(),
    write: z.boolean(),
    delete: z.boolean()
});

export class DriveRouter {
    baseProcedure: TRPCBaseProcedure;
    router: TRPCRouter;
    driveCore: DriveCore;
    constructor(baseProcedure: TRPCBaseProcedure, router: TRPCRouter, driveCore: DriveCore) {
        this.baseProcedure = baseProcedure;
        this.router = router;
        this.driveCore = driveCore;
    }

    _router() {
        return this.router({
            /**
             * Create a drive folder.
             *
             * @param folderName - The name of the folder.
             * @param parentId - The id of the parent. Null for default root node.
             * @param description - The description of the folder.
             *
             * @return IDriveNode
             */
            createDriveFolder: this.baseProcedure.input(z.object({
                folderName: z.string(),
                parentId: z.optional(z.union([z.string(), z.null()])),
                description: z.optional(z.string())
            })).mutation(async (opts) => {
                return await this.driveCore.createDriveFolder(opts.ctx.user, opts.input.folderName, opts.input.parentId ?? null, false, opts.input.description);
            }),
            /**
             * Create a drive file.
             *
             * @param parentId - The id of the parent node.
             *
             * @return IDriveNode
             */
            createDriveFile: this.baseProcedure.input(z.object({
                parentId: z.optional(z.union([z.string(), z.null()])),
                description: z.optional(z.string()),
                files: z.object({
                    file: z.array(FileUploadSchema)
                })
            })).mutation(async (opts) => {
                return await this.driveCore.createDriveFile(opts.ctx.user, opts.input.parentId ?? null, opts.input.description,
                    enumFileTypes[(opts.input.files.file[0].filename.split('.').pop() || '').toUpperCase() as keyof typeof enumFileTypes], opts.input.files.file[0]);
            }),
            createRecursiveDrives: this.baseProcedure.input(z.object({
                parentId: z.string(),
                files: z.object({
                    files: z.array(FileUploadSchema)
                }),
                paths: z.union([z.array(z.array(z.string())), z.string()])
            })).mutation(async (opts) => {
                return await this.driveCore.createRecursiveDrives(opts.ctx.user, opts.input.parentId, opts.input.files.files, typeof opts.input.paths === 'string' ? JSON.parse(opts.input.paths) : opts.input.paths);
            }),
            /**
             * Get the drive nodes of a user, including own drives and shared drives.
             *
             * @param userId - The id of the user.
             * @param rootId - The id of the root drive if specified.
             *
             * @return Record<string, IDriveNode[] - An object where key is the user Id and value is the list of drive nodes.
             */
            getDrives: this.baseProcedure.input(z.object({
                rootId: z.optional(z.string())
            })).query(async (opts) => {
                return this.driveCore.getDrives(opts.ctx.user, opts.input.rootId);
            }),
            /**
             * Edit a drive node.
             *
             * @param requester - The id of the requester.
             * @param driveId - The id of the driver.
             * @param managerId - The id of the manager.
             * @param name - The name of the drive.
             * @param description - The description of the drive.
             * @param parentId - The id of the parent node.
             * @param children - The ids of the childeren.
             * @param sharedUsers - Shared users.
             * @param sharedGroups - Shared user groups.
             *
             * @return driveIds - The list of drive ids influenced.
             */
            editDrive: this.baseProcedure.input(z.object({
                driveId: z.string(),
                managerId: z.optional(z.string()),
                name: z.optional(z.string()),
                description: z.optional(z.string()),
                parentId: z.optional(z.string()),
                children: z.optional(z.array(z.string())),
                sharedUsers: z.optional(z.array(ZDrivePermission)),
                sharedGroups: z.optional(z.array(ZDrivePermission))
            })).mutation(async (opts) => {
                return await this.driveCore.editDrive(
                    opts.ctx.user,
                    opts.input.driveId,
                    opts.input.managerId,
                    opts.input.name,
                    opts.input.description,
                    opts.input.parentId,
                    opts.input.children,
                    opts.input.sharedUsers
                );
            }),
            /**
             * Share a drive to a user via email. The children drives will also be influenced.
             *
             * @param userEmails - The emails of the users.
             * @param driveId - The id of the drive.
             * @param permissions - The permission object.
             *
             * @return driveIds - The list of drive ids influenced.
             */
            shareDriveToUserViaEmail: this.baseProcedure.input(z.object({
                userEmails: z.array(z.string()),
                driveId: z.string(),
                permissions: z.object({
                    read: z.boolean(),
                    write: z.boolean(),
                    delete: z.boolean()
                })
            })).mutation(async (opts) => {
                return this.driveCore.shareDriveToUserViaEmail(opts.ctx.req.user, opts.input.userEmails, opts.input.driveId, opts.input.permissions);
            }),
            /**
             * Delete a drive node.
             *
             * @param driveId - The id of the drive.
             *
             * @return IDriveNode
             */
            deleteDrive: this.baseProcedure.input(z.object({
                driveId: z.string()
            })).mutation(async (opts) => {
                return this.driveCore.deleteDrive(opts.ctx.user, opts.input.driveId);
            }),
            /**
             * Copy a drive node to another parent.
             *
             * @param driveId - The id of the drive.
             * @param targetParentId - The id of the target parent.
             *
             * @return IDriveNode
             */
            copyDrive: this.baseProcedure.input(z.object({
                driveId: z.string(),
                targetParentId: z.string()
            })).mutation(async (opts) => {
                return this.driveCore.copyDrive(opts.ctx.user, opts.input.driveId, opts.input.targetParentId);
            })
        });
    }
}


