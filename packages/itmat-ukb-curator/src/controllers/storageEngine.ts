/* storage engine for multer */
import express from 'express';
import csvparse from 'csv-parse';
import multer from 'multer';
import { UKBCurationDatabase } from '../database/database';
import { UKBFields, FieldEntry, FieldMap } from '../curation/UKBFields';
import { UKBCoding, CodingMap } from '../curation/UKBCoding';
import { server } from '../index';

const parseOptions: csvparse.Options = {
    delimiter: ',',
    quote: '"'
};

interface fieldDescription {
    fieldId: number,
    instance: number,
    array: number
}

interface headerArrayElement {
        coding: undefined | CodingMap,
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

/* batch insert, saving codings to memory, patient centric ~ 20min */ 

class _CSVStorageEngine implements multer.StorageEngine {
    public _handleFile(req: express.Request, file: any, cb: (error?: any, info?: object) => void): void {
        const incomingStream = file.stream;
        let isHeader = true;
        let numOfSubj = 0;
        let lineNum: number = 0;
        let startTime: number;
        let endTime: number;
        let fieldNumber: number;
        const fieldDict = UKBCurationDatabase.FIELD_DICT;
        const fieldsWithError: number[] = [];
        const header: (headerArrayElement|undefined)[] = [ undefined ];  //the first element is subject id
        const parseStream: NodeJS.ReadableStream = incomingStream.pipe(csvparse(parseOptions)); //piping the incoming stream to a parser stream
        let bulkInsert = UKBCurationDatabase.UKB_data_collection.initializeUnorderedBulkOp();

        parseStream.on('data', async (line: string[]) => {
            if (isHeader) {
                startTime = Date.now();
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
                    const fieldInfo = (fieldDict as FieldMap)[fieldDescription.fieldId];
                    if (fieldInfo
                            && fieldInfo.Instances >= fieldDescription.instance
                            && fieldInfo.Array >= fieldDescription.array) { //making sure the fieldid in the csv file is not bogus
                        const valueType: string = fieldInfo.ValueType;
                        if (fieldInfo.Coding && (UKBCurationDatabase.CODING_DICT as CodingMap)[fieldInfo.Coding]) {
                            fieldToBeAdded = {
                                coding: (UKBCurationDatabase.CODING_DICT as CodingMap)[fieldInfo.Coding],
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
                if (numOfSubj > 2000) {     //race condition?
                    numOfSubj = 0;
                    bulkInsert.execute((err: Error, result) => {
                        if (err) { console.log((err as any).writeErrors[1].err); return; };
                        if (lineNum == 502616) {
                            endTime = Date.now();
                            console.log('time: ', endTime - startTime);
                        }
                    });
                    bulkInsert = UKBCurationDatabase.UKB_data_collection.initializeUnorderedBulkOp();
                }
            }
        });

        parseStream.on('end', () => {
            cb(null, { numOfSubj, fieldsWithError }); 
        } )
    }

    public _removeFile(req: express.Request, file: any, callback: (error: Error) => void): void {

    }
    
}

export const CSVStorageEngine = Object.freeze(new _CSVStorageEngine());
