import merge from 'deepmerge';
import fs from 'fs-extra';
import { IObjectStoreConfig, IDatabaseBaseConfig } from 'itmat-commons';
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

export interface IConfiguration extends IServerConfig {
    database: IDatabaseBaseConfig;
    objectStore: IObjectStoreConfig;
    nodemailer: INodemailerConfig;
    useSSL: boolean;
    aesSecret: string;
    sessionsSecret: string;
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
            const { TEST_SMTP_CRED, TEST_SMTP_USERNAME, TEST_RECEIVER_EMAIL_ADDR, SKIP_EMAIL_TEST } = process.env;
            if (SKIP_EMAIL_TEST !== 'true') {
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
            } else {
                console.warn(chalk.yellow('[[WARNING]]: Skipping email tests because SKIP_EMAIL_TEST has been set to "true".'));
            }
        }

        return config;
    }

}

export default ConfigurationManager.expand('config/config.json');
