import { ServerBase, CustomError, IServerBaseConfig, Logger } from 'itmat-utils';
import { Database, IDatabaseConfig } from '../database/database';
import { JobDispatcher } from '../jobDispatch/dispatcher';
import { Poller, OpenStackSwiftObjectStore } from 'itmat-utils';

interface IServerConfig extends IServerBaseConfig<IDatabaseConfig> {
    pollingInterval: number
}

export class Server extends ServerBase<IDatabaseConfig, Database, IServerConfig> {
    protected async additionalChecksAndActions(): Promise<void> {
        const dispatcher = new JobDispatcher(this.db, this.objStore);
        await dispatcher.initialise();
        const poller = new Poller('me', undefined, this.db.jobs_collection!, this.config.pollingInterval, dispatcher.dispatch);
        poller.setInterval();
        return;
    }
}