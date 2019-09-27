import fs from 'fs-extra';
import merge from 'deepmerge';
import configDefaults from '../../config/config.sample.json';
import { IServerConfig } from '../server/server.js';
import { IDatabaseBaseConfig } from 'itmat-utils/dist/database';
import { IOpenSwiftObjectStoreConfig } from 'itmat-utils';

interface IConfiguration extends IServerConfig {
    database: IDatabaseBaseConfig,
    swift: IOpenSwiftObjectStoreConfig
}

class ConfigurationManager {

    static expand(configurationFile: string): IConfiguration {

        try {
            if (fs.existsSync(configurationFile)) {

                const content = fs.readFileSync(configurationFile, 'utf8');

                return merge(configDefaults, JSON.parse(content));
            }
        } catch (e) {
            console.error('Could not parse configuration file.');
        }

        return configDefaults;
    }

}

export default ConfigurationManager.expand('config/config.json');