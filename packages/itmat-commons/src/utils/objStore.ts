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
            if (this.client)
                await this.client.listBuckets();
            return true;
        } catch (__unused__exception) {
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

    public async uploadFile(fileStream: Readable, bucketId: string, uri: string): Promise<string> {
        if (!this.client) {
            throw new Error('Connection failed.');
        }
        const lowerCaseBucketId = bucketId.toLowerCase();
        const bucketExists = await this.client.bucketExists(lowerCaseBucketId);
        if (!bucketExists) {
            await this.client.makeBucket(lowerCaseBucketId, this.config?.bucketRegion ?? '');
        }

        /* check if object already exists because if it does, minio supplant the old file without warning*/
        let fileExists;
        try {
            await this.client.statObject(lowerCaseBucketId, uri);
            fileExists = true;
        } catch (__unused__exception) {
            fileExists = false;
        }

        if (fileExists) {
            throw new Error(`File "${uri}" of bucket "${bucketId}" already exists.`);
        }
        const result = await this.client.putObject(lowerCaseBucketId, uri, fileStream);
        return result.etag;
    }

    public async copyObject(sourceBucket: string, sourceUri: string, targetBucket: string, targetUri: string) {
        if (!this.client) {
            throw new Error('Connection failed.');
        }

        const lowerSourceBucket = sourceBucket.toLowerCase();
        const lowerTargetBucket = targetBucket.toLowerCase();

        // Ensure target bucket exists
        const bucketExists = await this.client.bucketExists(lowerTargetBucket);
        if (!bucketExists) {
            await this.client.makeBucket(lowerTargetBucket, this.config?.bucketRegion ?? '');
        }
        // Copy the object
        const conds = new Minio.CopyConditions();
        const result = await this.client.copyObject(lowerTargetBucket, targetUri, `/${lowerSourceBucket}/${sourceUri}`, conds);
        if (Object.hasOwn(result, 'Etag'))
            return (result as Record<string, unknown>)?.['Etag'];
        else
            return (result as Record<string, unknown>)?.['etag'];
    }

    public async downloadFile(buckerId: string, uri: string): Promise<Readable> {
        if (!this.client) {
            throw new Error('Connection failed.');
        }
        // PRECONDITION: studyId and file exists (checked by interface resolver)
        const lowerBuckerId = buckerId.toLowerCase();
        const stream = this.client.getObject(lowerBuckerId, uri);
        return stream as Promise<Readable>;
    }
}
