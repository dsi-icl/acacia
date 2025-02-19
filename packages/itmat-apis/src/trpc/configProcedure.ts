import { TRPCBaseProcedure, TRPCRouter } from './trpc';
import { z } from 'zod';
import { ConfigCore } from '@itmat-broker/itmat-cores';
import { enumConfigType, enumStudyBlockColumnValueType } from '@itmat-broker/itmat-types';

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
    defaultFileBlocks: z.array(z.object({
        title: z.string(),
        fieldIds: z.array(z.string()),
        defaultFileColumns: z.array(z.object({
            title: z.string(),
            property: z.string(),
            type: z.nativeEnum(enumStudyBlockColumnValueType)
        })),
        defaultFileColumnsPropertyColor: z.string()
    })),
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
    defaultLXDMaximumInstances: z.number(),
    defaultLXDMaximumInstanceCPUCores: z.number(),
    defaultLXDMaximumInstanceDiskSize: z.number(),
    defaultLXDMaximumInstanceMemory: z.number(),
    defaultLXDMaximumInstanceLife: z.number()
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
    defaultFileBucketId: z.string(),
    defaultMaximumFileSize: z.number()
});

export class ConfigRouter {
    baseProcedure: TRPCBaseProcedure;
    router: TRPCRouter;
    configCore: ConfigCore;
    constructor(baseProcedure: TRPCBaseProcedure, router: TRPCRouter, configCore: ConfigCore) {
        this.baseProcedure = baseProcedure;
        this.router = router;
        this.configCore = configCore;
    }

    _router() {
        return this.router({
            /**
             * Get the config.
             *
             * @param configType - The type of the config.
             * @param key - The key of the config. studyid, userid, or null for system.
             * @param useDefault - Whether to use the default config if not found.
             *
             * @returns IConfig
             */
            getConfig: this.baseProcedure.input(z.object({
                configType: z.nativeEnum(enumConfigType),
                key: z.union([z.string(), z.null()]),
                useDefault: z.boolean()
            })).query(async (opts) => {
                return await this.configCore.getConfig(opts.input.configType, opts.input.key, opts.input.useDefault);
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
            editConfig: this.baseProcedure.input(z.object({
                configType: z.nativeEnum(enumConfigType),
                key: z.union([z.string(), z.null()]),
                properties: z.union([ZSystemConfig, ZStudyConfig, ZUserConfig, ZDocConfig, ZCacheConfig, ZDomainConfig])
            })).mutation(async (opts) => {
                return await this.configCore.editConfig(opts.ctx.user, opts.input.configType, opts.input.key, opts.input.properties);
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
            createConfig: this.baseProcedure.input(z.object({
                configType: z.nativeEnum(enumConfigType),
                key: z.union([z.string(), z.null()]),
                properties: z.union([ZSystemConfig, ZStudyConfig, ZUserConfig, ZDocConfig, ZCacheConfig, ZDomainConfig])
            })).mutation(async (opts) => {
                return await this.configCore.createConfig(opts.ctx.user, opts.input.configType, opts.input.key, opts.input.properties);
            })
        });
    }
}



