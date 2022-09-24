import { IServerBaseConfig, ServerBase } from '@itmat-broker/itmat-commons';
import { IConfiguration } from '../utils/configManager';


export interface IServerConfig extends IServerBaseConfig {
    pollingInterval: number;
}

export class Server extends ServerBase<IServerConfig> {
    constructor(protected config: IConfiguration) {
        super(config);
    }
    protected async additionalChecksAndActions(): Promise<void> {
        return;
    }
}
