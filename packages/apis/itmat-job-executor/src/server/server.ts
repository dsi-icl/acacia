import { IServerBaseConfig, ServerBase } from '@itmat/utils';


export interface IServerConfig extends IServerBaseConfig {
    pollingInterval: number;
}

export class Server extends ServerBase<IServerConfig> {
    protected async additionalChecksAndActions(): Promise<void> { }
}
