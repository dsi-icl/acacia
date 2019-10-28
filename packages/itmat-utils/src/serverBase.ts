export interface IServerBaseConfig {
    server: {
        port: number
    };
}

export abstract class ServerBase<T extends IServerBaseConfig> {

    protected config: T;

    constructor(config: T) {
        this.config = config;
    }

    protected abstract additionalChecksAndActions(): Promise<void>;
}
