import mongodb from 'mongodb';
import { JobModels } from './models/index';

export interface IObjectStoreConfig {
    uri: string,
}

export abstract class ObjectStore<T extends IObjectStoreConfig> {
    protected readonly config: T;

    constructor(config: T) {
        this.config = config;
    }

    public abstract async connect(): Promise<void>;

    public abstract async uploadFile(incomingStream: NodeJS.ReadableStream, jobEntry: JobModels.IJobEntry, fileName: string): Promise<void>;

    public abstract async downloadFile(fileName: string, jobId: string): Promise<NodeJS.ReadableStream>;
}
