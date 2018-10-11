import express from 'express';
import { Server, DatabaseConfig, CustomError, ServerConfig, Models } from 'itmat-utils';
import { UKBCurationDatabase, UKBDatabaseConfig } from '../database/database';
import { Express, Request, NextFunction } from 'express';
import { UKBDataCurator } from '../curation/UKBData';
import { Router } from './router';
import fetch, { Response } from 'node-fetch';


interface UKBCuratorServerConfig extends ServerConfig{
    database: UKBDatabaseConfig
}

export class UKBCuratorServer extends Server<UKBCuratorServerConfig> {
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
            if (change.fullDocument.numberOfTransferredFiles !== change.fullDocument.numberOfFilesToTransfer) {
                return;
            }
            const fileName = Models.JobModels.jobTypes.UKB_CSV_UPLOAD.requiredFiles[0];
            const { id: jobId } = change.fullDocument;

            const fetchResponse: Response = await fetch(`http://localhost:8080/fileDownload/${jobId}/${fileName}`);
            if (fetchResponse.status !== 200) return;  //maybe try again?

            const curator = new UKBDataCurator(jobId, fileName, fetchResponse.body);
            curator.processIncomingStreamAndUploadToMongo();
        });

        return new Router() as Express;
    }
}
