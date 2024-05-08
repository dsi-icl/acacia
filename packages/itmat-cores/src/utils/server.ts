import { IServerBaseConfig } from '@itmat-broker/itmat-commons';

export interface IServerConfig extends IServerBaseConfig {
    bcrypt: {
        saltround: number
    };
}
