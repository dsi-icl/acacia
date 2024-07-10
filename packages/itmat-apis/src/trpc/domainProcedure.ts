import { z } from 'zod';
import { FileUploadSchema } from '@itmat-broker/itmat-types';
import { TRPCDomainCore } from '@itmat-broker/itmat-cores';
import { TRPCBaseProcedure, TRPCRouter } from './trpc';



export class DomainRouter {
    baseProcedure: TRPCBaseProcedure;
    router: TRPCRouter;
    domainCore: TRPCDomainCore;
    constructor(baseProcedure: TRPCBaseProcedure, router: TRPCRouter, domainCore: TRPCDomainCore) {
        this.baseProcedure = baseProcedure;
        this.router = router;
        this.domainCore = domainCore;
    }

    _router() {
        return this.router({
            /**
             * Get domain by domainId, domainName or domainPath.
             *
             * @param domainId - The id of the domain.
             * @param domainName - The name of the domain.
             * @param domainPath - The path of the domain.
             *
             * @returns The domain objects.
             */
            getDomains: this.baseProcedure.input(z.object({
                domainId: z.optional(z.string()),
                domainName: z.optional(z.string()),
                domainPath: z.optional(z.string())
            })).query(async (opts) => {
                return await this.domainCore.getDomains(opts.ctx.req?.user ?? opts.ctx.user, opts.input.domainId, opts.input.domainName, opts.input.domainPath);
            }),
            /**
             * Create a domain.
             *
             * @param domainName - The name of the domain.
             * @param domainPath - The path of the domain.
             * @param files - The files of the domain.
             *
             * @returns The domain object.
             */
            createDomain: this.baseProcedure.input(z.object({
                domainName: z.string(),
                domainPath: z.string(),
                files: z.optional(z.object({
                    logo: z.optional(z.array(FileUploadSchema))
                })),
                color: z.optional(z.string())
            })).mutation(async (opts) => {
                return await this.domainCore.createDomain(opts.ctx.req?.user ?? opts.ctx.user, opts.input.domainName, opts.input.domainPath, opts.input.files?.logo?.[0], opts.input.color);
            }),
            /**
             * Edit a domain.
             *
             * @param domainId - The id of the domain.
             * @param domainName - The name of the domain.
             * @param domainPath - The path of the domain.
             * @param files - The files of the domain.
             *
             * @returns The domain object.
             */
            editDomain: this.baseProcedure.input(z.object({
                domainId: z.string(),
                domainName: z.optional(z.string()),
                domainPath: z.optional(z.string()),
                files: z.optional(z.object({
                    logo: z.optional(z.array(FileUploadSchema))
                })),
                color: z.optional(z.string())
            })).mutation(async (opts) => {
                return await this.domainCore.editDomain(opts.ctx.req?.user ?? opts.ctx.user, opts.input.domainId, opts.input.domainName, opts.input.domainPath, opts.input.files?.logo?.[0], opts.input.color);
            }),
            /**
             * Delete a domain.
             *
             * @param domainId - The id of the domain.
             *
             * @returns The domain object.
             */
            deleteDomain: this.baseProcedure.input(z.object({
                domainId: z.string()
            })).mutation(async (opts) => {
                return await this.domainCore.deleteDomain(opts.ctx.req?.user ?? opts.ctx.user, opts.input.domainId);
            })
        });
    }
}