/* storage engine for multer */
import express from 'express';
import multer from 'multer';
import { objectStore } from '../objectStore/OpenStackObjectStore';
import { CarrierDatabase } from '../database/database';
import { JobModels } from 'itmat-utils/dist/models';
/* batch insert, saving codings to memory, patient centric ~ 20min */ 


declare global {
    namespace NodeJS {
        interface ReadableStream {
            destroy(any: any): void;
        }
    }
}

class StorageEngine implements multer.StorageEngine {
    public async _handleFile(req: express.Request, file: any, cb: (error?: any, info?: object) => void): Promise<void> {
        const incomingStream: NodeJS.ReadableStream = file.stream;

        if (!req.body.jobId || !req.body.fileName) {
            incomingStream.destroy('Please place the file at the bottom of the form.');
            return;
        }

        const job: JobModels.IJobEntry = await CarrierDatabase.jobs_collection.findOne({ id: req.body.jobId }, { projection: { requester: 1 }} );
        if (job === null || job === undefined) {
            incomingStream.destroy('Job not found.');
            return;
        }

        objectStore.uploadFile(incomingStream, job);


        incomingStream.on('end', () => {
            cb(null, {});
        } )
    }

    public _removeFile(req: express.Request, file: any, callback: (error: Error) => void): void {

    }
    
}

export const storageEngine = Object.freeze(new StorageEngine());
