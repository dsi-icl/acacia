import { FileUploadSchema } from '@itmat-broker/itmat-types';
import { z } from 'zod';
import { baseProcedure, router } from './trpc';
import { TRPCFileCore, TRPCOrganisationCore } from '@itmat-broker/itmat-cores';
import { db } from '../database/database';
import { objStore } from '../objStore/objStore';

const organisationCore = new TRPCOrganisationCore(db, new TRPCFileCore(db, objStore));

export const organisationRouter = router({
    /**
     * Get organisations.
     *
     * @param organisationId - The organisation id.
     *
     * @returns - IOrganisation[]
     */
    getOrganisations: baseProcedure.input(z.object({
        organisationId: z.optional(z.string())
    })).query(async (opts) => {
        return organisationCore.getOrganisations(opts.ctx.user, opts.input.organisationId);
    }),
    /**
     * Create a new organisation.
     *
     * @param name - The name of the organisation.
     * @param shortname - The shortname of the organisation.
     * @param files - The files of the organisation.
     *
     * @returns - IOrganisation
     */
    createOrganisation: baseProcedure.input(z.object({
        name: z.string(),
        shortname: z.string(),
        files: z.optional(z.object({
            profile: z.optional(z.array(FileUploadSchema))
        }))
    })).mutation(async (opts) => {
        return organisationCore.createOrganisation(opts.ctx.user, opts.input.name, opts.input.shortname, opts.input.files?.profile?.[0]);
    }),
    /**
     * Edit an organisation.
     *
     * @param organisationId - The organisation id.
     * @param name - The name of the organisation.
     * @param shortname - The shortname of the organisation.
     * @param files - The files of the organisation.
     *
     * @returns - IOrganisation
     */
    editOrganisation: baseProcedure.input(z.object({
        organisationId: z.string(),
        name: z.string(),
        shortname: z.string(),
        files: z.optional(z.object({
            profile: z.optional(z.array(FileUploadSchema))
        }))
    })).mutation(async (opts) => {
        return organisationCore.editOrganisation(opts.ctx.user, opts.input.organisationId, opts.input.name, opts.input.shortname, opts.input.files?.profile?.[0]);
    }),
    /**
     * Delete an organisation.
     *
     * @param organisationId - The organisation id.
     *
     * @returns - IOrganisation
     */
    deleteOrganisation: baseProcedure.input(z.object({
        organisationId: z.string()
    })).mutation(async (opts) => {
        return organisationCore.deleteOrganisation(opts.ctx.user, opts.input.organisationId);
    })
});