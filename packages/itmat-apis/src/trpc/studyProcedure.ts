import { IUser, FileUploadSchema } from '@itmat-broker/itmat-types';
import { z } from 'zod';
import { StudyCore } from '@itmat-broker/itmat-cores';
import { TRPCBaseProcedure, TRPCRouter } from './trpc';

export class StudyRouter {
    baseProcedure: TRPCBaseProcedure;
    router: TRPCRouter;
    studyCore: StudyCore;
    constructor(baseProcedure: TRPCBaseProcedure, router: TRPCRouter, studyCore: StudyCore) {
        this.baseProcedure = baseProcedure;
        this.router = router;
        this.studyCore = studyCore;
    }

    _router() {
        return this.router({
            /**
             * Get the info of studies.
             *
             * @param studyId - The if of the study.
             *
             * @return Partial<IStudy>
             */
            getStudies: this.baseProcedure.input(z.object({
                studyId: z.optional(z.string())
            })).query(async (opts) => {
                const requester: IUser = opts.ctx.req?.user ?? opts.ctx.user;
                return await this.studyCore.getStudies(requester, opts.input.studyId);
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
            createStudy: this.baseProcedure.input(z.object({
                name: z.string(),
                description: z.optional(z.string()),
                files: z.optional(z.object({
                    profile: z.optional(z.array(FileUploadSchema))
                }))
            })).mutation(async (opts) => {
                return await this.studyCore.createStudy(opts.ctx.req.user, opts.input.name, opts.input.description, opts.input.files?.profile?.[0]);
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
            editStudy: this.baseProcedure.input(z.object({
                studyId: z.string(),
                name: z.optional(z.string()),
                description: z.optional(z.string()),
                files: z.optional(z.object({
                    profile: z.optional(z.array(FileUploadSchema))
                }))
            })).mutation(async (opts) => {
                return await this.studyCore.editStudy(opts.ctx.req.user, opts.input.studyId, opts.input.name, opts.input.description, opts.input.files?.profile?.[0]);
            }),
            /**
             * Edit the visibility of a study.
             *
             * @param studyId - The id of the study.
             * @param isPublic - The visibility status of the study.
             *
             * @return Partial<IStudy>
             */
            editStudyVisibility: this.baseProcedure.input(z.object({
                studyId: z.string(),
                isPublic: z.boolean()
            })).mutation(async (opts) => {
                return await this.studyCore.editStudyVisibility(opts.ctx.req.user, opts.input.studyId, opts.input.isPublic);
            }),
            /**
             * Delete a study.
             *
             * @param studyId - The id of the study.
             *
             * @return IGenericResponse - The obejct of IGenericResponse.
             */
            deleteStudy: this.baseProcedure.input(z.object({
                studyId: z.string()
            })).mutation(async (opts) => {
                return await this.studyCore.deleteStudy(opts.ctx.req.user, opts.input.studyId);
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
            createDataVersion: this.baseProcedure.input(z.object({
                studyId: z.string(),
                dataVersion: z.string(),
                tag: z.string()
            })).mutation(async (opts) => {
                return await this.studyCore.createDataVersion(opts.ctx.req.user, opts.input.studyId, opts.input.tag, opts.input.dataVersion);
            }),
            /**
             * Set a data version as the current data version of a  study.
             *
             * @param studyId - The id of the study.
             * @param dataVersionId - The id of the data version.
             *
             * @return IGenreicResponse
             */
            setDataversionAsCurrent: this.baseProcedure.input(z.object({
                studyId: z.string(),
                dataVersionId: z.string()
            })).mutation(async (opts) => {
                return await this.studyCore.setDataversionAsCurrent(opts.ctx.req.user, opts.input.studyId, opts.input.dataVersionId);
            })
        });
    }
}