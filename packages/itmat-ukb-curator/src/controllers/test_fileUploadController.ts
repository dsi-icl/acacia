import express from 'express';
import { UKBCSVDataCurator } from '../curation/implementation3';
import { server, db } from '../index';

export function test_fileUploadController(req: express.Request, res: express.Response): void {
    const incomingStream: NodeJS.ReadableStream = (req.file as any).stream;
    const { jobId, fileName } = req.params;

    const curator = new UKBCSVDataCurator(db, jobId, fileName, incomingStream, server.FIELD_DICT, server.CODING_DICT);
    curator.processIncomingStreamAndUploadToMongo();
}