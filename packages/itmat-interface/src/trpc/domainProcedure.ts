import { z } from 'zod';
import { FileUploadSchema } from '@itmat-broker/itmat-types';
import { baseProcedure, router } from './trpc';
import { TRPCDomainCore, TRPCFileCore } from '@itmat-broker/itmat-cores';
import { db } from '../database/database';
import { objStore } from '../objStore/objStore';

const domainCore = new TRPCDomainCore(db, new TRPCFileCore(db, objStore));

export const domainRouter = router({
    /**
     * Get domain by domainId, domainName or domainPath.
     *
     * @param domainId - The id of the domain.
     * @param domainName - The name of the domain.
     * @param domainPath - The path of the domain.
     *
     * @returns The domain objects.
     */
    getDomains: baseProcedure.input(z.object({
        domainId: z.optional(z.string()),
        domainName: z.optional(z.string()),
        domainPath: z.optional(z.string())
    })).query(async (opts) => {
        return await domainCore.getDomains(opts.ctx.req?.user ?? opts.ctx.user, opts.input.domainId, opts.input.domainName, opts.input.domainPath);
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
    createDomain: baseProcedure.input(z.object({
        domainName: z.string(),
        domainPath: z.string(),
        files: z.optional(z.object({
            logo: z.optional(z.array(FileUploadSchema))
        })),
        color: z.optional(z.string())
    })).mutation(async (opts) => {
        return await domainCore.createDomain(opts.ctx.req?.user ?? opts.ctx.user, opts.input.domainName, opts.input.domainPath, opts.input.files?.logo?.[0], opts.input.color);
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
    editDomain: baseProcedure.input(z.object({
        domainId: z.string(),
        domainName: z.optional(z.string()),
        domainPath: z.optional(z.string()),
        files: z.optional(z.object({
            logo: z.optional(z.array(FileUploadSchema))
        })),
        color: z.optional(z.string())
    })).mutation(async (opts) => {
        return await domainCore.editDomain(opts.ctx.req?.user ?? opts.ctx.user, opts.input.domainId, opts.input.domainName, opts.input.domainPath, opts.input.files?.logo?.[0], opts.input.color);
    }),
    /**
     * Delete a domain.
     *
     * @param domainId - The id of the domain.
     *
     * @returns The domain object.
     */
    deleteDomain: baseProcedure.input(z.object({
        domainId: z.string()
    })).mutation(async (opts) => {
        return await domainCore.deleteDomain(opts.ctx.req?.user ?? opts.ctx.user, opts.input.domainId);
    })
});