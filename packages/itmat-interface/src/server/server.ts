import { CustomError, IServerBaseConfig, ServerBase } from '@itmat-broker/itmat-commons';
import { IConfiguration } from '../utils/configManager';

export interface IServerConfig extends IServerBaseConfig {
    bcrypt: {
        saltround: number
    };
}

export class Server extends ServerBase<IServerConfig> {
    constructor(protected config: IConfiguration) {
        super(config);
    }
    protected async additionalChecksAndActions(): Promise<void> {
        if (isNaN(parseInt(`${this.config.bcrypt.saltround}`, 10))) {
            console.log(new CustomError('Salt round must be a number'));
            process.exit(1);
        }
    }
}
