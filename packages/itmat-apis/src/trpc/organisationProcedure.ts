import { FileUploadSchema } from '@itmat-broker/itmat-types';
import { z } from 'zod';
import { OrganisationCore } from '@itmat-broker/itmat-cores';
import { TRPCBaseProcedure, TRPCRouter } from './trpc';

export class OrganisationRouter {
    baseProcedure: TRPCBaseProcedure;
    router: TRPCRouter;
    organisationCore: OrganisationCore;
    constructor(baseProcedure: TRPCBaseProcedure, router: TRPCRouter, organisationCore: OrganisationCore) {
        this.baseProcedure = baseProcedure;
        this.router = router;
        this.organisationCore = organisationCore;
    }

    _router() {
        return this.router({
            /**
             * Get organisations.
             *
             * @param organisationId - The organisation id.
             *
             * @returns - IOrganisation[]
             */
            getOrganisations: this.baseProcedure.input(z.object({
                organisationId: z.optional(z.string())
            })).query(async (opts) => {
                return this.organisationCore.getOrganisations(opts.ctx.user, opts.input.organisationId);
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
            createOrganisation: this.baseProcedure.input(z.object({
                name: z.string(),
                shortname: z.optional(z.string()),
                files: z.optional(z.object({
                    profile: z.optional(z.array(FileUploadSchema))
                }))
            })).mutation(async (opts) => {
                return this.organisationCore.createOrganisation(opts.ctx.user, opts.input.name, opts.input.shortname, opts.input.files?.profile?.[0]);
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
            editOrganisation: this.baseProcedure.input(z.object({
                organisationId: z.string(),
                name: z.string(),
                shortname: z.string(),
                files: z.optional(z.object({
                    profile: z.optional(z.array(FileUploadSchema))
                }))
            })).mutation(async (opts) => {
                return this.organisationCore.editOrganisation(opts.ctx.user, opts.input.organisationId, opts.input.name, opts.input.shortname, opts.input.files?.profile?.[0]);
            }),
            /**
             * Delete an organisation.
             *
             * @param organisationId - The organisation id.
             *
             * @returns - IOrganisation
             */
            deleteOrganisation: this.baseProcedure.input(z.object({
                organisationId: z.string()
            })).mutation(async (opts) => {
                return this.organisationCore.deleteOrganisation(opts.ctx.user, opts.input.organisationId);
            })
        });
    }
}