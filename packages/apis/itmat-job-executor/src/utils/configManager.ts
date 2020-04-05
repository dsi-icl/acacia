import merge from 'deepmerge';
import fs from 'fs';
import { IObjectStoreConfig, IDatabaseBaseConfig, Logger } from '@itmat/utils';
import configDefaults from '../../config/config.sample.json';
import { IServerConfig } from '../server/server';

interface IConfiguration extends IServerConfig {
    database: IDatabaseBaseConfig;
    objectStore: IObjectStoreConfig;
}

class ConfigurationManager {
    public static expand(configurationFile: string): IConfiguration {
        try {
            if (fs.existsSync(configurationFile)) {
                const content = fs.readFileSync(configurationFile, 'utf8');

                return merge(configDefaults, JSON.parse(content));
            }
        } catch (e) {
            Logger.error('Could not parse configuration file.');
        }

        return configDefaults;
    }
}

export default ConfigurationManager.expand('config/config.json');
