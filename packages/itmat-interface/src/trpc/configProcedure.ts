import { baseProcedure, router } from './trpc';
import { z } from 'zod';
import { TRPCConfigCore } from '@itmat-broker/itmat-cores';
import { db } from '../database/database';
import { enumConfigType } from '@itmat-broker/itmat-types';

const configCore = new TRPCConfigCore(db);

const ZBase = z.object({
    id: z.string(),
    life: z.object({
        createdTime: z.number(),
        createdUser: z.string(),
        deletedTime: z.number().nullable(),
        deletedUser: z.string().nullable()
    }),
    metadata: z.record(z.unknown())
});

// ZSystemConfig schema
const ZSystemConfig = ZBase.extend({
    defaultBackgroundColor: z.string(),
    defaultMaximumFileSize: z.number(),
    defaultFileBucketId: z.string(),
    defaultProfileBucketId: z.string(),
    logoLink: z.string().nullable(),
    logoSize: z.array(z.string()),
    archiveAddress: z.string(),
    defaultEventTimeConsumptionBar: z.array(z.number()),
    defaultUserExpireDays: z.number()
});

// ZStudyConfig schema
const ZStudyConfig = ZBase.extend({
    defaultStudyProfile: z.string().nullable(),
    defaultMaximumFileSize: z.number(),
    defaultRepresentationForMissingValue: z.string(),
    defaultFileColumns: z.array(z.object({
        title: z.string(),
        type: z.string()
    })),
    defaultFileColumnsPropertyColor: z.string().nullable(),
    defaultFileDirectoryStructure: z.object({
        pathLabels: z.array(z.string()),
        description: z.string().nullable()
    }),
    defaultVersioningKeys: z.array(z.string())
});

// ZUserConfig schema
const ZUserConfig = ZBase.extend({
    defaultUserExpiredDays: z.number(),
    defaultMaximumFileSize: z.number(),
    defaultMaximumFileRepoSize: z.number(),
    defaultMaximumRepoSize: z.number(),
    defaultFileBucketId: z.string(),
    defaultMaximumQPS: z.number(),
    defaultLXDMaximumContainers: z.number(),
    defaultLXDMaximumContainerCPUCores: z.number(),
    defaultLXDMaximumContainerDiskSize: z.number(),
    defaultLXDMaximumContainerMemory: z.number(),
    defaultLXDMaximumContainerLife: z.number()
});

// ZOrganisationConfig schema

// ZCacheConfig schema
const ZCacheConfig = ZBase.extend({
    defaultFileBucketId: z.string(),
    defaultMaximumFileSize: z.number()
});

// ZDocConfig schema
const ZDocConfig = ZBase.extend({
    defaultFileBucketId: z.string(),
    defaultMaximumFileSize: z.number()
});

// ZDomainConfig schema
const ZDomainConfig = ZBase.extend({
    defaultFileBucketId: z.string()
});

export const configRouter = router({
    /**
     * Get the config.
     *
     * @param configType - The type of the config.
     * @param key - The key of the config. studyid, userid, or null for system.
     * @param useDefault - Whether to use the default config if not found.
     *
     * @returns IConfig
     */
    getConfig: baseProcedure.input(z.object({
        configType: z.nativeEnum(enumConfigType),
        key: z.union([z.string(), z.null()]),
        useDefault: z.boolean()
    })).query(async (opts) => {
        return await configCore.getConfig(opts.input.configType, opts.input.key, opts.input.useDefault);
    }),
    /**
     * Edit the config.
     *
     * @param configType - The type of the config.
     * @param key - The key of the config.
     * @param properties - The updated properties.
     *
     * @returns IGenericResponse
     */
    editConfig: baseProcedure.input(z.object({
        configType: z.nativeEnum(enumConfigType),
        key: z.union([z.string(), z.null()]),
        properties: z.union([ZSystemConfig, ZStudyConfig, ZUserConfig, ZDocConfig, ZCacheConfig, ZDomainConfig])
    })).mutation(async (opts) => {
        return await configCore.editConfig(opts.ctx.user, opts.input.configType, opts.input.key, opts.input.properties);
    }),
    /**
     * Create the config.
     *
     * @param configType - The type of the config.
     * @param key - The key of the config.
     * @param properties - The updated properties.
     *
     * @returns IGenericResponse
     */
    createConfig: baseProcedure.input(z.object({
        configType: z.nativeEnum(enumConfigType),
        key: z.union([z.string(), z.null()]),
        properties: z.union([ZSystemConfig, ZStudyConfig, ZUserConfig, ZDocConfig, ZCacheConfig, ZDomainConfig])
    })).mutation(async (opts) => {
        return await configCore.createConfig(opts.ctx.user, opts.input.configType, opts.input.key, opts.input.properties);
    })
});


