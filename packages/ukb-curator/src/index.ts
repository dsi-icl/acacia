import { Logger, Models } from 'itmat-utils';
import { Collection } from 'mongodb';
import { UKBCSVCurator } from './curation/UKBCSVCurator';
import { UKBImageCurator } from './curation/UKBImageCurator';
import { ICodingEntry, ICodingMap } from './models/UKBCoding';
import { IFieldEntry, IFieldMap } from './models/UKBFields';

export class UKBCurator {
    private CODING_MAP: ICodingMap;
    private FIELD_MAP: IFieldMap;
    private performedAtLeastOneFetch: boolean;

    constructor(
        private readonly fieldCollection: Collection,
        private readonly codingCollection: Collection,
        private readonly jobsCollection: Collection,
        private readonly dataCollection: Collection,
    ) {
        this.CODING_MAP = {};
        this.FIELD_MAP = {};
        this.performedAtLeastOneFetch = false;
    }

    public async updateUKBCodingAndFieldsMap(): Promise<void> {
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

        this.performedAtLeastOneFetch = true;
        return;
    }

    public async uploadIncomingCSVStreamToMongo(studyName: string, jobId: string, fileName: string, incomingWebStream: NodeJS.ReadableStream, parseOptions?: any) {
        if (!this.performedAtLeastOneFetch) {
            Logger.error('Trying to upload to mongo without fetching coding and field info first.');
            return;
        }
        const curator = new UKBCSVCurator(this.dataCollection, this.jobsCollection, studyName, jobId, fileName, incomingWebStream, this.FIELD_MAP, this.CODING_MAP, parseOptions);
        await curator.processIncomingStreamAndUploadToMongo();
    }

    public async curateImagingData(document: Models.JobModels.IJobEntry<Models.JobModels.IDataobj_UKB_IMAGE_UPLOAD_job>) {
        if (!this.performedAtLeastOneFetch) {
            Logger.error('Trying to upload to mongo without fetching coding and field info first.');
            return;
        }
        const curator = new UKBImageCurator(this.FIELD_MAP, this.dataCollection, this.jobsCollection);
        await curator.updateData(document);
    }

    public async updateUKBFieldAndCodingCollection() {
        const curator = {};
    }
}
