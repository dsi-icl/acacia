import express from 'express';
import { Server, IDatabaseConfig, CustomError, IServerConfig, Models } from 'itmat-utils';
import { UKBCurationDatabase, IUKBDatabaseConfig } from '../database/database';
import { Express, Request, NextFunction } from 'express';
import { UKBDataCurator } from '../curation/UKBData';
import { Router } from './router';
import fetch, { Response } from 'node-fetch';


interface IUKBCuratorServerConfig extends IServerConfig{
    database: IUKBDatabaseConfig
}

export class UKBCuratorServer extends Server<IUKBCuratorServerConfig> {
    protected async initialise(): Promise<Express> {
        try {  //try to establish a connection to database first; if failed, exit the program
            await UKBCurationDatabase.connect(this.config.database);
        } catch (e) {
            const { mongo_url: mongoUri, database } = this.config.database;
            console.log(
                new CustomError(`Cannot connect to database host ${mongoUri} - db = ${database}.`, e)
            );
            process.exit(1);
        }

        UKBCurationDatabase.changeStream.on('change', async (change) => {
            console.log('register change');
            if (change.fullDocument.numberOfTransferredFiles !== change.fullDocument.numberOfFilesToTransfer) {
                return;
            }
            const fileName = Models.JobModels.jobTypes.UKB_CSV_UPLOAD.requiredFiles[0];
            const { id: jobId } = change.fullDocument;
            console.log(`http://localhost:3000/jobs/${jobId}/${fileName}/fileDownload`);
            const fetchResponse: Response = await fetch(`http://localhost:3000/jobs/${jobId}/${fileName}/fileDownload`);
            if (fetchResponse.status !== 200) {console.log(fetchResponse.status, fetchResponse); return;}  //maybe try again?

            const curator = new UKBDataCurator(jobId, fileName, fetchResponse.body);
            curator.processIncomingStreamAndUploadToMongo();
        });

        return new Router() as Express;
    }
}
