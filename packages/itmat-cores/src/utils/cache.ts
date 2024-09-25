import { FileUpload, IUserWithoutToken, enumFileCategories, enumFileTypes } from '@itmat-broker/itmat-types';
import { FileCore } from '../coreFunc/fileCore';
import { v4 as uuid } from 'uuid';
import { Readable } from 'stream';
import { ObjectStore } from '@itmat-broker/itmat-commons';

export async function convertToBufferAndUpload(fileCore: FileCore, requester: IUserWithoutToken, jsonObject: Record<string, unknown> | Record<string, unknown>[]) {

    const fileUpload: FileUpload = {
        filename: uuid(),
        mimetype: 'application/json',
        encoding: 'utf-8',
        createReadStream: () => {
            const jsonString = JSON.stringify(jsonObject);
            const stream = new Readable();
            stream.push(jsonString);
            stream.push(null); // Indicates the end of the stream
            return stream;
        }

    };

    const res = await fileCore.uploadFile(
        requester,
        null,
        null,
        fileUpload,
        enumFileTypes.JSON,
        enumFileCategories.CACHE,
        undefined,
        undefined
    );
    return res;
}

export async function getJsonFileContents(objStore: ObjectStore, buckerId: string, uri: string): Promise<Record<string, unknown>> {
    try {
        // Get the Readable stream from the downloadFile method
        const stream = await objStore.downloadFile(buckerId, uri);

        // Accumulate the stream data
        const chunks: Buffer[] = [];
        for await (const chunk of stream) {
            chunks.push(Buffer.from(chunk));
        }

        // Convert the accumulated data to a string
        const data = Buffer.concat(chunks).toString('utf-8');
        // Parse and return the JSON object
        return JSON.parse(data);
    } catch {
        throw new Error('Failed to fetch and parse JSON file.');
    }
}
