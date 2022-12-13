import * as Minio from 'minio';
import { Logger } from './logger';
import { Readable, PassThrough } from 'stream';

export interface IObjectStoreConfig {
    host: string;
    port: number;
    accessKey: string;
    secretKey: string;
    bucketRegion?: string;
    useSSL: boolean;
}

type StreamFileMap = Record<string, {
    stream: PassThrough;
    resultPromise: Promise<Minio.UploadedObjectInfo>;
}>;

type StreamMap = Record<string, StreamFileMap>;

const streamMap: StreamMap = {};

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

    public async uploadFile(fileStream: Readable, studyId: string, uri: string, final = true): Promise<string | null> {

        return new Promise((resolve, reject) => {

            (async () => {
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

                if (!streamMap[lowercasestudyid])
                    streamMap[lowercasestudyid] = {};
                if (!streamMap[lowercasestudyid][uri]) {
                    const stream = new PassThrough();
                    streamMap[lowercasestudyid][uri] = {
                        stream,
                        resultPromise: this.client!.putObject(lowercasestudyid, uri, stream)
                    };
                }

                const currentStream = streamMap[lowercasestudyid][uri].stream;
                fileStream.on('close', () => {
                    if (!final)
                        return resolve(null);
                    currentStream.destroy();
                    streamMap[lowercasestudyid][uri].resultPromise.then(p => {
                        delete streamMap[lowercasestudyid][uri];
                        resolve(p.etag);
                    });
                });
                fileStream.on('error', (error) => {
                    console.error('Object Store file stream failure', error);
                    reject(error);
                });
                fileStream.pipe(currentStream, { end: final });
            })();
        });
    }

    public async downloadFile(studyId: string, uri: string): Promise<Readable> {
        // PRECONDITION: studyId and file exists (checked by interface resolver)
        const lowercasestudyid = studyId.toLowerCase();
        const stream = this.client!.getObject(lowercasestudyid, uri);
        return stream as Promise<Readable>;
    }
}
