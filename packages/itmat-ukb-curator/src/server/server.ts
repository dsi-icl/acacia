import express from 'express';
import { Server, Database, databaseConfig, CustomError } from 'itmat-utils';
import { CodingMap, CodingEntry } from '../curation/UKBCoding';
import { FieldMap, FieldEntry } from '../curation/UKBFields';
import { Router } from './router';


interface UKBCuratorServerConfig {
    database: databaseConfig,
    server: {
        port: number
    }
}

export class UKBCuratorServer extends Server<UKBCuratorServerConfig> {
    private readonly port: number;
    public CODING_DICT: undefined | CodingMap;
    public FIELD_DICT:  undefined | FieldMap;

    constructor(config: UKBCuratorServerConfig) {
        super(config);
        this.port = config.server.port;
    }

    protected async initialise(): Promise<express.Application> {
        try {  //try to establish a connection to database first; if failed, exit the program
            console.log('Connecting to the database..');
            await Database.connect(this.config.database);
            console.log('Connected.');

            console.log('Fetching UKB codings..');
            const codingCursor = Database.UKB_coding_collection.find();
            const codingDict: CodingMap = {};
            await codingCursor.forEach((doc: CodingEntry) => {
                if(codingDict[doc.Coding]) {
                    codingDict[doc.Coding][String(doc.Value)] = doc.Meaning;
                } else {
                    codingDict[doc.Coding] = {};
                    codingDict[doc.Coding][String(doc.Value)] = doc.Meaning;
                }
            });
            this.CODING_DICT = codingDict;
            
            console.log('Fetching UKB Field Info..');
            const fieldCursor = Database.UKB_field_dictionary_collection.find();
            const fieldDict: FieldMap = {};
            await fieldCursor.forEach((doc: FieldEntry) => {
                fieldDict[doc.FieldID] = doc;
            });
            this.FIELD_DICT = fieldDict;
        } catch (e) {
            const { mongo_url: mongoUri, database } = this.config.database;
            console.log(
                new CustomError(`Cannot connect to database host ${mongoUri} - db = ${database}.`, e)
            );
            process.exit(1);
        }

        return new Router() as express.Application;
    }

    public async start(): Promise<void> {
        const app: express.Application = await this.initialise();
        app.listen(this.port, () => { console.log(`I am listening on port ${this.port}!`); });
    }
}
