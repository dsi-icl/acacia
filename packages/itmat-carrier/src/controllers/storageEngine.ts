/* storage engine for multer */
import express from 'express';
import multer from 'multer';
import { objectStore } from '../objectStore/OpenStackObjectStore';
/* batch insert, saving codings to memory, patient centric ~ 20min */ 

class StorageEngine implements multer.StorageEngine {
    public _handleFile(req: express.Request, file: any, cb: (error?: any, info?: object) => void): void {
        const incomingStream: NodeJS.ReadableStream = file.stream;

        objectStore.uploadFile(incomingStream, {} as any);

        incomingStream.on('end', () => {
            cb(null, {});
        } )
    }

    public _removeFile(req: express.Request, file: any, callback: (error: Error) => void): void {

    }
    
}

export const storageEngine = Object.freeze(new StorageEngine());
