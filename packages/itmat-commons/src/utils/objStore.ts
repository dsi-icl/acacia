import * as Minio from 'minio';
import { Logger } from './logger';
import type { Readable } from 'stream';

export interface IObjectStoreConfig {
    host: string;
    port: number;
    accessKey: string;
    secretKey: string;
    bucketRegion?: string;
    useSSL: boolean;
}

export class ObjectStore {
    private config?: IObjectStoreConfig;
    private client?: Minio.Client;

    public async isConnected(): Promise<boolean> {
        try {
            await this.client!.listBuckets();
            return true;
        } catch (e) {
            return false;
        }
    }

    public async disconnect(): Promise<boolean> {
        this.client = undefined;
        return true;
    }

    public async connect(config: IObjectStoreConfig): Promise<(Minio.BucketItemFromList)[]> {
        Logger.log('Checking connection to object store.');
        this.config = config;
        const minioClient = new Minio.Client({
            endPoint: config.host,
            port: config.port,
            useSSL: config.useSSL,
            accessKey: config.accessKey,
            secretKey: config.secretKey
        });
        this.client = minioClient;
        return await minioClient.listBuckets();
    }

    public async uploadFile(fileStream: Readable, studyId: string, uri: string): Promise<string> {
        const lowercasestudyid = studyId.toLowerCase();
        const bucketExists = await this.client!.bucketExists(lowercasestudyid);

        if (!bucketExists) {
            await this.client!.makeBucket(lowercasestudyid, this.config?.bucketRegion ?? '');
        }

        /* check if object already exists because if it does, minio supplant the old file without warning*/
        let fileExists;
        try {
            await this.client!.statObject(lowercasestudyid, uri);
            fileExists = true;
        } catch (e) {
            fileExists = false;
        }

        if (fileExists) {
            throw new Error(`File "${uri}" of study "${studyId}" already exists.`);
        }

        const result = await this.client!.putObject(lowercasestudyid, uri, fileStream);
        return result.etag;
    }

    public async downloadFile(studyId: string, uri: string): Promise<Readable> {
        // PRECONDITION: studyId and file exists (checked by interface resolver)
        const lowercasestudyid = studyId.toLowerCase();
        const stream = this.client!.getObject(lowercasestudyid, uri);
        return stream as Promise<Readable>;
    }
}
