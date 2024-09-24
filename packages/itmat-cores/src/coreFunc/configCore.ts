import { CoreError, ICacheConfig, IConfig, IDocConfig, IDomainConfig, IStudyConfig, ISystemConfig, IUserConfig, IUserWithoutToken, defaultSettings, enumConfigType, enumCoreErrors, enumReservedUsers, enumUserTypes } from '@itmat-broker/itmat-types';
import { DBType } from '../database/database';
import { v4 as uuid } from 'uuid';
import { makeGenericResponse } from '../utils';

export class ConfigCore {
    db: DBType;
    constructor(db: DBType) {
        this.db = db;
    }
    /**
     * Get the config. Suggestions: always set useDefault to true.
     *
     * @param configType - The type of the config..
     * @param key - The key of the config. studyid, userid, or null for system.
     * @param useDefault - Whether to use the default config if not found.
     *
     * @return IConfig
     */
    public async getConfig(configType: enumConfigType, key: string | null, useDefault: boolean) {
        const config = await this.db.collections.configs_collection.findOne({ 'type': configType, 'key': key, 'life.deletedTime': null });
        if (!config) {
            if (useDefault) {
                return {
                    id: uuid(),
                    type: configType,
                    key: key,
                    life: {
                        createdTime: Date.now(),
                        createdUser: enumReservedUsers.SYSTEM,
                        deletedTime: null,
                        deletedUser: null
                    },
                    metadata: {},
                    properties: (() => {
                        if (configType === enumConfigType.CACHECONFIG) {
                            return defaultSettings.cacheConfig;
                        } else if (configType === enumConfigType.STUDYCONFIG) {
                            return defaultSettings.studyConfig;
                        } else if (configType === enumConfigType.SYSTEMCONFIG) {
                            return defaultSettings.systemConfig;
                        } else if (configType === enumConfigType.USERCONFIG) {
                            return defaultSettings.userConfig;
                        } else if (configType === enumConfigType.DOCCONFIG) {
                            return defaultSettings.docConfig;
                        } else if (configType === enumConfigType.DOMAINCONFIG) {
                            return defaultSettings.domainConfig;
                        } else {
                            throw new CoreError(
                                enumCoreErrors.CLIENT_MALFORMED_INPUT,
                                'Config type not recognised.'
                            );
                        }
                    })()
                };
            } else {
                throw new CoreError(
                    enumCoreErrors.CLIENT_MALFORMED_INPUT,
                    'Config does not exist.'
                );
            }
        }
        return config;
    }

    /**
     * Edit the config.
     *
     * @param requester - The requester.
     * @param configType - The type of the config.
     * @param key - The key of the config.
     * @param properties - The updated properties.
     *
     * @returns IGenericResponse
     */
    public async editConfig(requester: IUserWithoutToken | undefined, configType: enumConfigType, key: string | null, properties: ISystemConfig | IStudyConfig | IUserConfig | IDocConfig | ICacheConfig | IDomainConfig) {
        if (!requester) {
            throw new CoreError(
                enumCoreErrors.NOT_LOGGED_IN,
                enumCoreErrors.NOT_LOGGED_IN
            );
        }

        // for now only admin can edit config, update it for further use
        if (requester.type !== enumUserTypes.ADMIN) {
            throw new CoreError(
                enumCoreErrors.NO_PERMISSION_ERROR,
                enumCoreErrors.NO_PERMISSION_ERROR
            );
        }

        // validate properties and config type match
        if (!((configType === enumConfigType.SYSTEMCONFIG && 'defaultBackgroundColor' in properties) ||
            (configType === enumConfigType.STUDYCONFIG && 'defaultStudyProfile' in properties) ||
            (configType === enumConfigType.USERCONFIG && 'defaultUserExpiredDays' in properties) ||
            (configType === enumConfigType.DOCCONFIG && properties['defaultFileBucketId'] === 'doc') ||
            (configType === enumConfigType.CACHECONFIG && properties['defaultFileBucketId'] === 'cache') ||
            (configType === enumConfigType.DOMAINCONFIG && properties['defaultFileBucketId'] === 'domain')
        )) {
            throw new CoreError(
                enumCoreErrors.CLIENT_MALFORMED_INPUT,
                'Config type and properties do not match.'
            );
        }

        const config = await this.db.collections.configs_collection.findOne({ 'type': configType, 'key': key, 'life.deletedTime': null });
        if (!config) {
            throw new CoreError(
                enumCoreErrors.CLIENT_MALFORMED_INPUT,
                'Config does not exist.'
            );
        }
        await this.db.collections.configs_collection.updateOne({ 'type': configType, 'key': key, 'life.deletedTime': null }, { $set: { properties: properties } });

        return makeGenericResponse(config.id, true, undefined, 'Config updated.');
    }

    /**
     * Create a new config.
     * Note, this API is used in case sth unusual happen. In most cases the API should neven be used.
     *
     * @param requester - The requester.
     * @param configType - The type of the config.
     * @param key - The key of the config.
     * @param properties - The properties of the config.
     *
     * @returns IConfig
     */
    public async createConfig(requester: IUserWithoutToken | undefined, configType: enumConfigType, key: string | null, properties: ISystemConfig | IStudyConfig | IUserConfig | IDocConfig | ICacheConfig | IDomainConfig) {
        if (!requester) {
            throw new CoreError(
                enumCoreErrors.NOT_LOGGED_IN,
                enumCoreErrors.NOT_LOGGED_IN
            );
        }

        if (requester.type !== enumUserTypes.ADMIN) {
            throw new CoreError(
                enumCoreErrors.NO_PERMISSION_ERROR,
                enumCoreErrors.NO_PERMISSION_ERROR
            );
        }

        const config: IConfig = {
            id: uuid(),
            type: configType,
            key: key,
            life: {
                createdTime: Date.now(),
                createdUser: requester.id,
                deletedTime: null,
                deletedUser: null
            },
            metadata: {},
            properties: properties
        };

        await this.db.collections.configs_collection.insertOne(config);
        return config;

    }
}