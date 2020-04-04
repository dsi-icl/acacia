import {
    CustomError, IServerBaseConfig, ServerBase, Logger,
} from '@itmat/utils';

export interface IServerConfig extends IServerBaseConfig {
    bcrypt: {
        saltround: number;
    };
}

export class Server extends ServerBase<IServerConfig> {
    constructor(protected config) {
        super(config);
    }

    protected async additionalChecksAndActions(): Promise<void> {
        if (isNaN(parseInt(this.config.bcrypt.saltround as any, 10))) {
            Logger.error(new CustomError('Salt round must be a number'));
            process.exit(1);
        }
    }
}
