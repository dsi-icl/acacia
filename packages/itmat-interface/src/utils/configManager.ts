import merge from 'deepmerge';
import fs from 'fs-extra';
import { IObjectStoreConfig } from 'itmat-utils';
import { IDatabaseBaseConfig } from 'itmat-utils/dist/database';
import configDefaults from '../../config/config.sample.json';
import { IServerConfig } from '../server/server.js';
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

        try {
            if (fs.existsSync(configurationFile)) {

                const content = fs.readFileSync(configurationFile, 'utf8');

                const config = merge(configDefaults, JSON.parse(content));

                if (process.env.CI === 'true') {
                    if (process.env.TEST_SMTP_CRED) config.nodemailer.auth.pass = process.env.TEST_SMTP_CRED;
                    if (process.env.TEST_SMTP_USERNAME) config.nodemailer.auth.user = process.env.TEST_SMTP_USERNAME;
                    if (process.env.TEST_SMTP_HOST) config.nodemailer.host = process.env.TEST_SMTP_HOST;
                    if (process.env.TEST_SMTP_PORT) config.nodemailer.port = parseInt(process.env.TEST_SMTP_PORT, 10);
                }

                return config;
            }
        } catch (e) {
            console.error('Could not parse configuration file.');
        }

        return configDefaults;
    }

}

export default ConfigurationManager.expand(process.env.TESTING === 'true' ? 'config/config.test.json' : 'config/config.json');
