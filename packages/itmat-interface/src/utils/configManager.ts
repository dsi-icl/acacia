import merge from 'deepmerge';
import fs from 'fs-extra';
import { IObjectStoreConfig, IDatabaseBaseConfig } from 'itmat-commons';
import configDefaults from '../../config/config.sample.json';
import { IServerConfig } from '../server/server.js';
import chalk from 'chalk';

export interface IConfiguration extends IServerConfig {
    appName: string;
    database: IDatabaseBaseConfig;
    objectStore: IObjectStoreConfig;
    nodemailer: any;
    aesSecret: string;
    sessionsSecret: string;
    adminEmail: string;
    ae_endpoint: string;
}

class ConfigurationManager {

    public static expand(configurationFile: string): IConfiguration {
        let config: IConfiguration;
        if (fs.existsSync(configurationFile)) {
            const content = fs.readFileSync(configurationFile, 'utf8');
            try {
                config = merge(configDefaults, JSON.parse(content));
            } catch (e) {
                console.error(chalk.red('Cannot parse configuration file. Using defaults.'));
                config = configDefaults;
            }
        } else {
            console.warn(chalk.red('Cannot find configuration file. Using defaults.'));
            config = configDefaults;
        }

        return config;
    }

}

export default ConfigurationManager.expand('config/config.json');
