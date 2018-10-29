import express from 'express';
import { UKBCSVDataCurator } from '../curation/curationImplementations/implementation1';

export function test_fileUploadController(req: express.Request, res: express.Response): void {
    const incomingStream: NodeJS.ReadableStream = (req.file as any).stream;
    const { jobId, fileName } = req.params;

    const curator = new UKBCSVDataCurator(jobId, fileName, incomingStream);
    curator.processIncomingStreamAndUploadToMongo();
    
}