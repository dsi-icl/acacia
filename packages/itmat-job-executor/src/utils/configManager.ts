import merge from 'deepmerge';
import fs from 'fs';
import { IOpenSwiftObjectStoreConfig, Logger } from 'itmat-utils';
import { IDatabaseBaseConfig } from 'itmat-utils/dist/database';
import configDefaults from '../../config/config.sample.json';
import { IServerConfig } from '../server/server.js';

interface IConfiguration extends IServerConfig {
    database: IDatabaseBaseConfig;
    swift: IOpenSwiftObjectStoreConfig;
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
