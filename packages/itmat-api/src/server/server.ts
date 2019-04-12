import { ServerBase, CustomError, IServerBaseConfig } from 'itmat-utils';
import { IDatabaseConfig } from '../database/database';

interface IServerConfig extends IServerBaseConfig<IDatabaseConfig> {
    bcrypt: {
        saltround: number
    }
}

export class Server extends ServerBase<IDatabaseConfig, IServerConfig> {
    protected async additionalChecksAndActions(): Promise<void> {
        if (isNaN(parseInt(this.config.bcrypt.saltround as any))) {
            console.log(
                new CustomError('Salt round must be a number')
            );
            process.exit(1);
        }
    }
}