import merge from 'deepmerge';
import fs from 'fs-extra';
import { IObjectStoreConfig } from 'itmat-utils';
import { IDatabaseBaseConfig } from 'itmat-utils/dist/database';
import configDefaults from '../../config/config.sample.json';
import { IServerConfig } from '../server/server.js';
import chalk from 'chalk';

export interface INodemailerConfig {
    service: string,
    auth: {
        user: string
        pass: string
    }
}

interface IConfiguration extends IServerConfig {
    database: IDatabaseBaseConfig;
    objectStore: IObjectStoreConfig;
    nodemailer: INodemailerConfig;
    useSSL: boolean;
    aesSecret: string;
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
            const { TEST_SMTP_CRED, TEST_SMTP_USERNAME, TEST_RECEIVER_EMAIL_ADDR } = process.env;
            if (TEST_SMTP_CRED) {
                console.log(chalk.green('Using env secret TEST_SMTP_CRED.'));
                config.nodemailer.auth.pass = TEST_SMTP_CRED;
            } else {
                console.log(chalk.blue('Cannot find env secret TEST_SMTP_CRED. Using default.'));
            }
            if (TEST_SMTP_USERNAME) {
                console.log(chalk.green('Using env secret TEST_SMTP_USERNAME.'));
                config.nodemailer.auth.user = TEST_SMTP_USERNAME;
            } else {
                console.log(chalk.blue('Cannot find env secret TEST_SMTP_USERNAME. Using default.'));
            }
            if (!TEST_RECEIVER_EMAIL_ADDR) {
                console.log(chalk.blue('Cannot find env secret TEST_RECEIVER_EMAIL_ADDR. Using default.'));
            }
        }

        return config;
    }

}

export default ConfigurationManager.expand('config/config.json');
