import merge from 'deepmerge';
import fs from 'fs-extra';
import path from 'path';
import { IObjectStoreConfig, IDatabaseBaseConfig, Logger } from '@itmat-broker/itmat-commons';
import configDefaults from '../../config/config.sample.json';
import chalk from 'chalk';
import SMTPTransport from 'nodemailer/lib/smtp-transport';

import {IServerBaseConfig} from '@itmat-broker/itmat-commons';

export interface IServerConfig extends IServerBaseConfig {
    bcrypt: {
        saltround: number,
    };
    pollingInterval: number;
}


export interface IConfiguration extends IServerConfig {
    appName: string;
    database: IDatabaseBaseConfig;
    objectStore: IObjectStoreConfig;
    nodemailer: SMTPTransport.Options & { auth: { user: string, pass: string } };
    aesSecret: string;
    sessionsSecret: string;
    adminEmail: string;
    aeEndpoint: string;
    useWebdav: boolean;
    webdavPort: number;
    lxdEndpoint: string;
    lxdStoragePool: string;
    lxdProject: string;
    webdavServer: string;
    systemKey: Record<string, string>;
    lxdCertFile: Record<string, string>;
    lxdRejectUnauthorized: boolean;
    jupyterPort: number;
}
export class ConfigurationManager {

    public static expand(configurationFiles: string[]): IConfiguration {

        let config = configDefaults;
        Logger.log('Applied default configuration.');

        configurationFiles.forEach((configurationFile) => {
            try {
                if (fs.existsSync(configurationFile)) {
                    const content = fs.readFileSync(configurationFile, 'utf8');
                    config = merge(config, JSON.parse(content));
                    Logger.log(`Applied configuration from ${path.resolve(configurationFile)}.`);
                }
            } catch (e) {
                Logger.error(chalk.red(`Cannot parse configuration file.${JSON.stringify(e)}`));
            }
        });

        return config;
    }

}

export default ConfigurationManager.expand((process.env['NODE_ENV'] === 'development' ? [path.join(__dirname.replace('dist', ''), 'config/config.json')] : []).concat(['config/config.json']));
