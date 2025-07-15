import merge from 'deepmerge';
import fs from 'fs-extra';
import path from 'path';
import { IObjectStoreConfig, IDatabaseBaseConfig, Logger } from '@itmat-broker/itmat-commons';
import configDefaults from '../../config/config.sample.json';
import { IServerConfig } from './server.js';
import chalk from 'chalk';
import SMTPTransport from 'nodemailer/lib/smtp-transport';

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
    webdavServer: string;
    lxdEndpoint: string;
    lxdPortRange: number[];  // the port range for lxd  a list of numbers
    lxdSquidProxy: string; // the squid proxy server for lxd
    lxdStoragePool: string;
    lxdProject: string;
    systemKey: Record<string, string>;
    lxdCertFile: Record<string, string>;
    lxdRejectUnauthorized: boolean;
    jupyterPort: number;
    dmp:  Record<string, unknown>;
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
            } catch (__unused__exception) {
                Logger.error(chalk.red('Cannot parse configuration file.'));
            }
        });

        return config;
    }

}
