import { ServerBase, Logger, CustomError} from '@itmat-broker/itmat-commons';

import {IServerConfig,  IConfiguration} from '../utils/configManager';

export class Runner extends ServerBase<IServerConfig> {
    constructor(protected override config: IConfiguration) {
        super(config);
    }
    protected async additionalChecksAndActions(): Promise<void> {
        if (isNaN(parseInt(`${this.config.bcrypt.saltround}`, 10))) {
            Logger.log(new CustomError('Salt round must be a number'));
            process.exit(1);
        }
    }
}