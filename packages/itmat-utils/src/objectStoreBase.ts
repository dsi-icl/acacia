import mongodb from 'mongodb';
import { JobModels } from './models/index';

export interface IObjectStoreBaseConfig {
    uri: string,
}

export abstract class ObjectStoreBase<T extends IObjectStoreBaseConfig> {
    protected readonly config: T;

    constructor(config: T) {
        this.config = config;
    }

    public abstract async connect(): Promise<void>;

    public abstract async uploadFile(incomingStream: NodeJS.ReadableStream, jobId: string, fileName: string): Promise<void>;

    public abstract async downloadFile(fileName: string, jobId: string): Promise<NodeJS.ReadableStream>;
}
