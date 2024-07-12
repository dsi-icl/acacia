import { IUser, FileUploadSchema } from '@itmat-broker/itmat-types';
import { z } from 'zod';
import { baseProcedure, router } from './trpc';
import { TRPCFileCore, TRPCPermissionCore, TRPCStudyCore } from '@itmat-broker/itmat-cores';
import { db } from '../database/database';
import { objStore } from '../objStore/objStore';

const studyCore = new TRPCStudyCore(db, objStore, new TRPCPermissionCore(db), new TRPCFileCore(db, objStore));

export const studyRouter = router({
    /**
     * Get the info of studies.
     *
     * @param studyId - The if of the study.
     *
     * @return Partial<IStudy>
     */
    getStudies: baseProcedure.input(z.object({
        studyId: z.optional(z.string())
    })).query(async (opts) => {
        const requester: IUser = opts.ctx.req?.user ?? opts.ctx.user;
        // if (opts.input.studyId) {
        //     await permissionCore.checkOperationPermissionByUser(requester.id, opts.input.studyId);
        // }
        return await studyCore.getStudies(requester, opts.input.studyId);
    }),
    /**
     * Create a study.
     *
     * @param name - The name of the study.
     * @param description - The description of the study.
     * @param profile - The profile of the study.
     *
     * @return IStudy
     */
    createStudy: baseProcedure.input(z.object({
        name: z.string(),
        description: z.optional(z.string()),
        files: z.optional(z.object({
            profile: z.optional(z.array(FileUploadSchema))
        }))
    })).mutation(async (opts) => {
        return await studyCore.createStudy(opts.ctx.req.user, opts.input.name, opts.input.description, opts.input.files?.profile?.[0]);
    }),
    /**
     * Edit a study.
     *
     * @param studyId - The id of the study.
     * @param name - The name of the study.
     * @param description - The description of the study.
     * @param profile - The profile of the user.
     *
     * @return Partial<IStudy>
     */
    editStudy: baseProcedure.input(z.object({
        studyId: z.string(),
        name: z.optional(z.string()),
        description: z.optional(z.string()),
        files: z.optional(z.object({
            profile: z.optional(z.array(FileUploadSchema))
        }))
    })).mutation(async (opts) => {
        return await studyCore.editStudy(opts.ctx.req.user, opts.input.studyId, opts.input.name, opts.input.description, opts.input.files?.profile?.[0]);
    }),
    /**
     * Delete a study.
     *
     * @param studyId - The id of the study.
     *
     * @return IGenericResponse - The obejct of IGenericResponse.
     */
    deleteStudy: baseProcedure.input(z.object({
        studyId: z.string()
    })).mutation(async (opts) => {
        return await studyCore.deleteStudy(opts.ctx.req.user, opts.input.studyId);
    }),
    /**
     * Create a new data version of the study.
     *
     * @param studyId - The id of the study.
     * @param tag - The tag of the study.
     * @param dataVersion - The new version of the study. User float number.
     *
     * @return IGenericResponse - The object of IGenericResponse.
     */
    createDataVersion: baseProcedure.input(z.object({
        studyId: z.string(),
        dataVersion: z.string(),
        tag: z.string()
    })).mutation(async (opts) => {
        return await studyCore.createDataVersion(opts.ctx.req.user, opts.input.studyId, opts.input.tag, opts.input.dataVersion);
    }),
    /**
     * Set a data version as the current data version of a  study.
     *
     * @param studyId - The id of the study.
     * @param dataVersionId - The id of the data version.
     *
     * @return IGenreicResponse
     */
    setDataversionAsCurrent: baseProcedure.input(z.object({
        studyId: z.string(),
        dataVersionId: z.string()
    })).mutation(async (opts) => {
        return await studyCore.setDataversionAsCurrent(opts.ctx.req.user, opts.input.studyId, opts.input.dataVersionId);
    })
});