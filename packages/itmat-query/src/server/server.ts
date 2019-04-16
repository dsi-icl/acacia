import { ServerBase, CustomError, IServerBaseConfig, Logger } from 'itmat-utils';
import { Database, IDatabaseConfig } from '../database/database';
import { Poller } from 'itmat-utils';


interface IServerConfig extends IServerBaseConfig {
    pollingInterval: number
}

export class Server extends ServerBase<IServerConfig> {
    protected async additionalChecksAndActions(): Promise<void> {

    }
}