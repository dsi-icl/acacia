import mongodb, { MongosOptions } from 'mongodb';
import { DatabaseConfig, Database, CustomError } from 'itmat-utils';
import { CodingMap, CodingEntry } from '../models/UKBCoding';
import { FieldMap, FieldEntry } from '../models/UKBFields';

export interface UKBDatabaseConfig extends DatabaseConfig {
    UKB_coding_collection: string,
    UKB_field_dictionary_collection: string,
    UKB_data_collection: string
}


export class UKBCurationDatabase extends Database {
    protected static config: UKBDatabaseConfig;
    public static UKB_coding_collection: mongodb.Collection;
    public static UKB_field_dictionary_collection: mongodb.Collection;
    public static UKB_data_collection: mongodb.Collection;
    public static jobs_collection: mongodb.Collection;
    public static changeStream: mongodb.ChangeStream;
    public static CODING_DICT: CodingMap;
    public static FIELD_DICT:  FieldMap;

    public static async connect(config: UKBDatabaseConfig): Promise<void> {
        if (!this.db) {
            /* any error throw here should be caught by the server calling this function */
            console.log('Connecting to the database..');
            const client: mongodb.MongoClient = await mongodb.MongoClient.connect(config.mongo_url, { useNewUrlParser: true });
            this.db = client.db(config.database);
            this.config = config;
            console.log('Connected.');

            /* checking the collections are already present; can change to create if not exist but gives warning */
            let collectionList: any[] = await this.db.listCollections({}).toArray();
            collectionList = collectionList.map(el => el.name) as string[];
            for (let each of [config.UKB_coding_collection, config.UKB_field_dictionary_collection, config.UKB_data_collection, config.jobs_collection]) {
                if (!collectionList.includes(each)) {
                    throw new CustomError(`Collection ${each} does not exist.`);
                }
            }

            /* now that everything exists let's bind them */
            this.UKB_coding_collection = this.db.collection(config.UKB_coding_collection);
            this.UKB_field_dictionary_collection = this.db.collection(config.UKB_field_dictionary_collection);
            this.UKB_data_collection = this.db.collection(config.UKB_data_collection);
            this.jobs_collection = this.db.collection(config.jobs_collection);

            /* Open a changestream to listen to job collection */
            const pipeline = [
                { $match: { 'fullDocument.jobType': 'UKB_CSV_UPLOAD', 'updateDescription.updatedFields.numberOfTransferredFiles': { $exists: true } } }
            ]
            this.changeStream = this.jobs_collection.watch(pipeline, { fullDocument: 'updateLookup' });

            /* Fetching coding dictionary to memory for faster parsing later; refresh at will / periodically */
            console.log('Fetching UKB codings..');
            const codingCursor = this.UKB_coding_collection.find();
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
            

            /* Fetching field dictionary to memory for faster parsing later; refresh at will / periodically */
            console.log('Fetching UKB Field Info..');
            const fieldCursor = this.UKB_field_dictionary_collection.find();
            const fieldDict: FieldMap = {};
            await fieldCursor.forEach((doc: FieldEntry) => {
                fieldDict[doc.FieldID] = doc;
            });
            this.FIELD_DICT = fieldDict;
        }
    }

    public static async flushCodingCollection(): Promise<void> {
        try {
            await this.UKB_coding_collection.drop();
            await this.db.createCollection(this.config.UKB_coding_collection);
            this.UKB_coding_collection = this.db.collection(this.config.UKB_coding_collection);
            await this.UKB_coding_collection.createIndex({ Coding: 1, Value: 1 });
        } catch (e) {

        }
    }
}