import csvparse from 'csv-parse';
import { IFieldEntry } from 'itmat-utils/dist/models/field';
import { Db } from 'itmat-utils/node_modules/@types/mongodb';
import uuidv4 from 'uuid/v4';
import { ILoaderPlugin } from './interface';

export class UKBFieldInfoPlugin implements ILoaderPlugin {
    private inputStream?: NodeJS.ReadableStream;
    private collectionName?: string;
    private dbClient?: Db;

    constructor(private readonly jobId: string, private readonly studyId: string) {}

    public setInputStream(inputStream: NodeJS.ReadableStream): UKBFieldInfoPlugin {
        this.inputStream = inputStream;
        return this;
    }

    public setTargetCollection(collectionName: string): UKBFieldInfoPlugin {
        this.collectionName = collectionName;
        return this;
    }

    public setDBClient(client: Db): UKBFieldInfoPlugin {
        this.dbClient = client;
        return this;
    }

    public async processInputStreamToFieldEntry() {
        if (!this.dbClient || !this.collectionName || !this.inputStream) {
            throw new Error('Cannot process input before setting dbClient, collectionName and inputStream.');
        }
        const collection = this.dbClient!.collection(this.collectionName);
        const bulkInsert = collection.initializeUnorderedBulkOp();
        const parser: NodeJS.ReadableStream = this.inputStream.pipe(csvparse({ columns: true, delimiter: '\t' })); // piping the incoming stream to a parser stream

        parser.on('data', async (line) => {
            console.log(line.instance_min, parseInt(line.instance_min));
            const field: IFieldEntry = {
                id: uuidv4(),
                studyId: 'UKBIOBANK',
                path: line.path,
                fieldId: line.field_id,
                fieldName: line.title,
                valueType: line.value_type,
                unit: line.units,
                itemType: line.item_type,
                numOfTimePoints: parseInt(line.instance_max) - parseInt(line.instance_min) + 1,
                numOfMeasurements: parseInt(line.array_max) - parseInt(line.array_min) + 1,
                startingTimePoint: parseInt(line.instance_min),
                startingMeasurement: parseInt(line.array_min),
                notes: line.notes,
                jobId: this.jobId,
                dateAdded: new Date().valueOf(),
                deleted: false,
            };
            bulkInsert.insert(field);
        });

        parser.on('end', () => {
            bulkInsert.execute((err: Error) => {
                console.log('FINSIHED LOADING');
                if (err) { console.log(err); return; }
            });
            console.log('end');
        });
    }


}
