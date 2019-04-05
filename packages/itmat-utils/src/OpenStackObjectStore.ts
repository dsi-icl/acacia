import { Store, Account, Container, Segment, DynamicLargeObject, StaticLargeObject } from 'os2';
import { JobModels } from './models/index';

export interface IOpenSwiftObjectStoreConfig {
    uri: string
    username: string,
    password: string
}

export class OpenStackSwiftObjectStore {
    private readonly config: IOpenSwiftObjectStoreConfig;
    private account?: Account;

    constructor(config: IOpenSwiftObjectStoreConfig) {
        this.config = config;
    }

    public async isConnected(): Promise<boolean> {
        try {
            await (this.account as any).getMetadata();
            return true;
        } catch (e) {
            return false;
        }
    }

    public async connect(): Promise<void> {
        const store = new Store(this.config.uri);
        const account = new Account(store, this.config.username, this.config.password);
        const connectResult: boolean | Error = await account.connect();
        if (typeof connectResult === 'boolean' && connectResult === false) {
            throw connectResult;
        }
        this.account = account;
        return; // success
    }

    public async uploadFile(fileStream: NodeJS.ReadableStream, jobId: string, fileName: string): Promise<void> {
        const container = new Container(this.account, jobId);
        // const metaData = container.getMetadata();
        await container.create();
        const segment = new Segment(container, fileName);
        await segment.createFromStream(fileStream); // error if thrown is caught by controller
        return;
    }

    public async downloadFile(fileName: string, jobId: string): Promise<NodeJS.ReadableStream> {
        // PRECONDITION: jobId and file exists (checked)
        // faltan checks
        const container = new Container(this.account, jobId);
        const segment = new Segment(container, fileName);
        return await segment.getContentStream();
    }
}
