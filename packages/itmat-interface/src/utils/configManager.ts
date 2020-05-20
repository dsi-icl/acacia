import merge from 'deepmerge';
import fs from 'fs-extra';
import { IObjectStoreConfig } from 'itmat-utils';
import { IDatabaseBaseConfig } from 'itmat-utils/dist/database';
import configDefaults from '../../config/config.sample.json';
import { IServerConfig } from '../server/server.js';
import chalk from 'chalk';
import { ProvidedRequiredArgumentsOnDirectivesRule } from 'graphql/validation/rules/ProvidedRequiredArgumentsRule';

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
            console.error(chalk.red('Cannot find configuration file. Using defaults.'));
            config = configDefaults;
        }

        if (process.env.CI === 'true') {
            if (process.env.TEST_SMTP_CRED) config.nodemailer.auth.pass = process.env.TEST_SMTP_CRED;
            if (process.env.TEST_SMTP_USERNAME) config.nodemailer.auth.user = process.env.TEST_SMTP_USERNAME;
            if (process.env.TEST_SMTP_HOST) config.nodemailer.host = process.env.TEST_SMTP_HOST;
            if (process.env.TEST_SMTP_PORT) config.nodemailer.port = parseInt(process.env.TEST_SMTP_PORT, 10);
        }

        return config;
    }

}

export default ConfigurationManager.expand('config/config.json');
