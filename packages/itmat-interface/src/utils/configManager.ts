import merge from 'deepmerge';
import fs from 'fs-extra';
import { IObjectStoreConfig } from 'itmat-utils';
import { IDatabaseBaseConfig } from 'itmat-utils/dist/database';
import configDefaults from '../../config/config.sample.json';
import { IServerConfig } from '../server/server.js';

export interface INodemailerConfig {
    host: string,
    port: number,
    secure: boolean,
    auth: {
        user: string
        pass: string
    }
}

interface IConfiguration extends IServerConfig {
    database: IDatabaseBaseConfig;
    objectStore: IObjectStoreConfig;
    nodemailer: INodemailerConfig;
    host: string;
    useSSL: boolean;
}

class ConfigurationManager {

    public static expand(configurationFile: string): IConfiguration {

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

export default ConfigurationManager.expand(process.env.TESTING === 'true' ? 'config/config.test.json' : 'config/config.json');
