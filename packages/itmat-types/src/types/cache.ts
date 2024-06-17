import { IBase } from './base';

/** We store large data as json in minio as a cache. */
export interface ICache extends IBase {
    keyHash: string;
    keys: Record<string, unknown>,
    uri: string;
    status: enumCacheStatus;
    type: enumCacheType
}

export enum enumCacheType {
    API = 'API',
}

export enum enumCacheStatus {
    OUTDATED = 'OUTDATED',
    INUSE = 'INUSE'
}