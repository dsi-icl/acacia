import merge from 'deepmerge';
import fs from 'fs-extra';
import path from 'path';
import { IObjectStoreConfig, IDatabaseBaseConfig } from '@itmat-broker/itmat-commons';
import configDefaults from '../../config/config.sample.json';
import { IServerConfig } from '../server/server.js';
import chalk from 'chalk';
import type nodemailer from 'nodemailer';

export interface IConfiguration extends IServerConfig {
    appName: string;
    database: IDatabaseBaseConfig;
    objectStore: IObjectStoreConfig;
    nodemailer: Parameters<typeof nodemailer.createTransport>[0];
    aesSecret: string;
    sessionsSecret: string;
    adminEmail: string;
    aeEndpoint: string;
}

class ConfigurationManager {

    public static expand(configurationFiles: string[]): IConfiguration {

        let config = configDefaults;
        console.log('Applied default configuration.');

        configurationFiles.forEach((configurationFile) => {
            try {
                if (fs.existsSync(configurationFile)) {
                    const content = fs.readFileSync(configurationFile, 'utf8');
                    config = merge(config, JSON.parse(content));
                    console.log(`Applied configuration from ${path.resolve(configurationFile)}.`);
                }
            } catch (e) {
                console.error(chalk.red('Cannot parse configuration file.'));
            }
        });

        return config;
    }

}

export default ConfigurationManager.expand((process.env.NODE_ENV === 'development' ? [path.join(__dirname.replace('dist', ''), 'config/config.json')] : []).concat(['config/config.json']));
