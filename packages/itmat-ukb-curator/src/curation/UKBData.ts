import csvparse from 'csv-parse';
import { UKBCurationDatabase } from '../database/database';
import { ICodingMap } from '../models/UKBCoding';
import { IFieldMap } from '../models/UKBFields';

interface headerArrayElement {
    coding: undefined | ICodingMap,
    valueType: string
}


const UKBiobankValueTypes: any = {   // 'date' are provided in yyyy-mm-dd;
    Integer: 'integer',
    'Categorical single': 'categorical single',
    'Categorical multiple': 'categorical multiple',
    Compound: 'compound',
    Date: 'date',
    Text: 'text',
    Continuous: 'float',
    Time: 'date'
}


/* update should be audit trailed */ 

export class UKBDataCurator {
    private readonly jobId: string;
    private readonly fileName: string;
    private readonly incomingWebStream: NodeJS.ReadableStream;
    private readonly parseOptions: csvparse.Options = {
        delimiter: ',',
        quote: '"'
    };

    constructor(jobId: string, fileName: string, incomingWebStream: NodeJS.ReadableStream) {
        this.jobId = jobId;
        this.fileName = fileName;
        this.incomingWebStream = incomingWebStream;
    }

    public async processIncomingStreamAndUploadToMongo() {
        console.log(`uploading for job ${this.jobId}`);
        let isHeader: boolean = true;
        let fieldNumber: number;
        const fieldDict = UKBCurationDatabase.FIELD_DICT;
        let numOfSubj = 0;
        let lineNum: number = 0;
        const fieldsWithError: number[] = [];
        const header: (headerArrayElement|undefined)[] = [ undefined ];  //the first element is subject id
        let bulkInsert = UKBCurationDatabase.UKB_data_collection.initializeUnorderedBulkOp();
        const parseStream: NodeJS.ReadableStream = this.incomingWebStream.pipe(csvparse(this.parseOptions)); //piping the incoming stream to a parser stream

        //check for intergrity
        parseStream.on('data', (line) => {
            console.log(line);
            if (isHeader) {
                /* pausing the stream so all the async ops on the first line must be completed before the second line is read */
                parseStream.pause();
                fieldNumber = line.length; //saving the fieldNum to check each line has the same #column
                isHeader = false;
                for (let i = 1; i < line.length; i++) { //starting from the second column
                    let fieldToBeAdded: any = {};
                    const el = line[i];
                    const fieldDescription = {    //add in data provenance and user too;
                        fieldId: parseInt(el.slice(0, el.indexOf('-'))),
                        instance: parseInt(el.slice(el.indexOf('-')+1, el.indexOf('.'))),
                        array: parseInt(el.slice(el.indexOf('.')+1))
                    };
                    const key = `${fieldDescription.fieldId}-${fieldDescription.instance}-${fieldDescription.array}`;
                    const fieldInfo = (fieldDict as IFieldMap)[fieldDescription.fieldId];
                    if (fieldInfo
                            && fieldInfo.Instances >= fieldDescription.instance
                            && fieldInfo.Array >= fieldDescription.array) { //making sure the fieldid in the csv file is not bogus
                        const valueType: string = fieldInfo.ValueType;
                        if (fieldInfo.Coding && (UKBCurationDatabase.CODING_DICT as ICodingMap)[fieldInfo.Coding]) {
                            fieldToBeAdded = {
                                coding: (UKBCurationDatabase.CODING_DICT as ICodingMap)[fieldInfo.Coding],
                                valueType: UKBiobankValueTypes[valueType],
                                fieldId: key
                            };
                            header.push(fieldToBeAdded);
                        } else {
                            fieldToBeAdded = {
                                valueType: UKBiobankValueTypes[valueType],
                                fieldId: key
                            };
                            header.push(fieldToBeAdded);
                        }
                    } else {
                        header.push(undefined);
                        fieldsWithError.push(fieldDescription.fieldId);
                    }
                }
                parseStream.resume();  //now that all promises have resolved, we can resume the stream
            } else {
                console.log('running second line');
                /* no need to pause stream here because the calls to database don't need to follow any order */
                if (line.length !== fieldNumber) {
                    throw Error('column number doesnt match');
                }
                const eid = line[0];
                const entry: any = { eid };
                for (let i = 1; i < line.length; i++) {
                    if (line[i] !== null && line[i] !== '' && header[i] !== undefined) {
                        if ((header[i] as any).coding) {
                            const meaning = (header[i] as any).coding[line[i]];
                            if (meaning !== undefined) {
                                entry[(header[i] as any).fieldId] = meaning;
                            } else {
                                if (isNaN(parseFloat(line[i]))) {
                                    console.log('CANNOT FIND MEANING', {
                                    });
                                } else {
                                    entry[(header[i] as any).fieldId] = parseFloat(line[i]);
                                }
                            }
                        } else {
                            entry[(header[i] as any).fieldId] = ((header[i] as any).valueType === 'integer' || (header[i] as any).valueType === 'float') ? parseFloat(line[i]) : line[i];
                        }
                    }
                }
                bulkInsert.insert(entry);
                numOfSubj++;
                console.log('lineNum', ++lineNum)
                if (numOfSubj > 2000) {     //race condition?   //PROBLEM: the last bit <2000 doesn't get uploaded\
                    numOfSubj = 0;
                    bulkInsert.execute((err: Error, result) => {
                        if (err) { console.log((err as any).writeErrors[1].err); return; };
                    });
                    bulkInsert = UKBCurationDatabase.UKB_data_collection.initializeUnorderedBulkOp();
                }
            }
        });

        parseStream.on('end', () => {
            console.log('end');
        });
    }
}