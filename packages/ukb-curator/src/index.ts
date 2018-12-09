import { Db, Collection } from "mongodb";
import { ServerBase, CustomError, IServerBaseConfig, Logger } from 'itmat-utils';
import { ICodingMap, ICodingEntry } from './models/UKBCoding';
import { IFieldMap, IFieldEntry } from './models/UKBFields';
import { UKBCSVCurator } from './curation/UKBCSVCurator';
import { UKBImageCurator } from './curation/UKBImageCurator';

class UKBCurator {
    private CODING_MAP: ICodingMap;
    private FIELD_MAP: IFieldMap;

    constructor(
        private readonly fieldCollection: Collection,
        private readonly codingCollection: Collection,
        private readonly jobsCollection: Collection,
        private readonly dataCollection: Collection
    ) {
        this.CODING_MAP = {};
        this.FIELD_MAP = {};
        this.updateUKBCodingAndFieldsInfo();
    }

    public async updateUKBCodingAndFieldsInfo(): Promise<void> {
        /* this function should be called periodically */
        Logger.log('Fetching UKB codings..');
        const codingCursor = this.codingCollection.find();
        const codingDict: ICodingMap = {};
        await codingCursor.forEach((doc: ICodingEntry) => {
            if (codingDict[doc.Coding]) {
                codingDict[doc.Coding][String(doc.Value)] = doc.Meaning;
            } else {
                codingDict[doc.Coding] = {};
                codingDict[doc.Coding][String(doc.Value)] = doc.Meaning;
            }
        });
        this.CODING_MAP = codingDict;
        Logger.log('Finished fetching UKB codings');

        Logger.log('Fetching UKB Field Info..');
        const fieldCursor = this.fieldCollection.find();
        const fieldDict: IFieldMap = {};
        await fieldCursor.forEach((doc: IFieldEntry) => {
            fieldDict[doc.FieldID] = doc;
        });
        this.FIELD_MAP = fieldDict;
        Logger.log('Finished fetching UKB fields');

        return;
    }

    public async uploadIncomingCSVStreamToMongo(jobId: string, fileName: string, incomingWebStream: NodeJS.ReadableStream, parseOptions?: any) {
        const curator = new UKBCSVCurator(this.dataCollection, this.jobsCollection, jobId, fileName, incomingWebStream, this.FIELD_MAP, this.CODING_MAP, parseOptions);
        curator.processIncomingStreamAndUploadToMongo();
    }

    public async curateImagingData() {
        const curator
    }

    public async updateUKBFieldAndCodingCollection() {
        
    }
}