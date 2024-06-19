import { CoreError, defaultSettings, enumConfigType, enumCoreErrors, enumReservedUsers } from '@itmat-broker/itmat-types';
import { DBType } from '../database/database';
import { v4 as uuid } from 'uuid';

export class TRPCConfigCore {
    db: DBType;
    constructor(db: DBType) {
        this.db = db;
    }
    /**
     * Get the config.
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
                        } else {
                            return defaultSettings.userConfig;
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
}