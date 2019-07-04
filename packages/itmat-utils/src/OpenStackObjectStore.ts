import { Store, Account, Container, Segment, DynamicLargeObject, StaticLargeObject } from 'os2';

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

    public async disconnect(): Promise<boolean> {
        try {
            await (this.account as any).disconnect();
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

    public async uploadFile(fileStream: NodeJS.ReadableStream, studyId: string, uri: string): Promise<string> {
        const containerList = await (this.account as any).listContainers();
        console.log('containerList', containerList);
        const container = new Container(this.account, studyId);

        if (!containerList.includes(studyId)) {
            await container.create();
        }
        const segment = new Segment(container, uri);
        await segment.createFromStream(fileStream); // error if thrown is caught by controller
        return uri;
    }

    public async downloadFile(studyId: string, uri: string): Promise<NodeJS.ReadableStream> {
        // PRECONDITION: jobId and file exists (checked)
        // faltan checks
        const container = new Container(this.account, studyId);
        const segment = new Segment(container, uri);
        return await segment.getContentStream();
    }
}
