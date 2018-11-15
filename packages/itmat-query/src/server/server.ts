import { ServerBase, CustomError, IServerBaseConfig, Logger } from 'itmat-utils';
import { Database, IDatabaseConfig } from '../database/database';
import { QueryEngine } from '../query/queryEngine';
import { Poller } from 'itmat-utils';

interface IServerConfig extends IServerBaseConfig<IDatabaseConfig> {
    pollingInterval: number
}

export class Server extends ServerBase<IDatabaseConfig, Database, IServerConfig> {
    protected async additionalChecksAndActions(): Promise<void> {
        const curator = new QueryEngine(this.db.UKB_data_collection!, this.db.query_collection!);
        const poller = new Poller('me', 'QUERY', this.db.query_collection!, this.config.pollingInterval, curator.processQuery);
        poller.setInterval();
        return;
    }
}