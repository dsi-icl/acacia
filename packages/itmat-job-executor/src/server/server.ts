import { ServerBase, IServerBaseConfig } from 'itmat-utils';


interface IServerConfig extends IServerBaseConfig {
    pollingInterval: number
}

export class Server extends ServerBase<IServerConfig> {
    protected async additionalChecksAndActions(): Promise<void> { }
}