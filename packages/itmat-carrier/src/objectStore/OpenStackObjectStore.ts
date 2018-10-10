import { Store, Account, Container, Segment, DynamicLargeObject, StaticLargeObject } from 'os2';
import { ObjectStore, IObjectStoreConfig, Models } from 'itmat-utils';
import config from '../config/config.json';

export interface IOpenSwiftObjectStoreConfig extends IObjectStoreConfig {
    username: string,
    password: string
}

/* Wrapper for os2 (for now); exposes a set of fixed interfaces so later we can use another kinds of object storages too */ 
class OpenStackSwiftObjectStore extends ObjectStore<IOpenSwiftObjectStoreConfig> {
    private account?: Account;

    constructor(config: IOpenSwiftObjectStoreConfig) {
        super(config);
    }

    public async connect(): Promise<void> {
        const store = new Store(this.config.uri);
        const account = new Account(store, this.config.username, this.config.password);
        const connectResult: boolean | Error = await account.connect();
        if (typeof connectResult === 'boolean' && connectResult === false) {
            throw connectResult;
        }
        this.account = account;
        return; //success
    }

    public async uploadFile(fileStream: NodeJS.ReadableStream, job: Models.JobModels.IJobEntry): Promise<void> {
        const container = new Container(this.account, `${job.requester}_${job.id}`);
        const metaData = container.getMetadata();
        container.create();
        const segment = new Segment(container, 'NAME');
        try {
            segment.createFromStream(fileStream);
        } catch (e) {
            throw e;
        }

    }

    public async downloadFile(jobEntry: Models.JobModels.IJobEntry, outgoingStream: NodeJS.WritableStream): Promise<void> {
        console.log('implementation');
        
    }
}

/* singleton */
export const objectStore = new OpenStackSwiftObjectStore(config.swift);