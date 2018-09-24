/* storage engine for multer */
import express from 'express';
import csvparse from 'csv-parse';
import multer from 'multer';
import { Database } from 'itmat-utils';
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
    fieldDescription: fieldDescription,
    metadata?: {
        coding: undefined | CodingMap,
        valueType: string
    }
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

/* batch insert, saving codings to memory, field centric */ 

class _CSVStorageEngine implements multer.StorageEngine {
    public _handleFile(req: express.Request, file: any, cb: (error?: any, info?: object) => void): void {
        const incomingStream = file.stream;
        let isHeader = true;
        let numOfSubj = 0;
        let lineNum: number = 0;
        let startTime: number;
        let endTime: number;
        let fieldNumber: number;
        const fieldsWithError: number[] = [];
        const header: (headerArrayElement|undefined)[] = [ undefined ];  //the first element is subject id
        const parseStream: NodeJS.ReadableStream = incomingStream.pipe(csvparse(parseOptions)); //piping the incoming stream to a parser stream

        parseStream.on('data', async (line: string[]) => {
            if (isHeader) {
                startTime = Date.now();
                /* pausing the stream so all the async ops on the first line must be completed before the second line is read */
                parseStream.pause();
                fieldNumber = line.length; //saving the fieldNum to check each line has the same #column
                isHeader = false;
                for (let i = 1; i < line.length; i++) { //starting from the second column
                    const el = line[i];
                    const fieldToBePushedToHeader: any = {};
                    const fieldDescription = {    //add in data provenance and user too;
                        fieldId: parseInt(el.slice(0, el.indexOf('-'))),
                        instance: parseInt(el.slice(el.indexOf('-')+1, el.indexOf('.'))),
                        array: parseInt(el.slice(el.indexOf('.')+1))
                    };
                    const fieldDict = server.FIELD_DICT;
                    const fieldInfo = (fieldDict as FieldMap)[fieldDescription.fieldId];
                    if (fieldInfo
                            && fieldInfo.Instances >= fieldDescription.instance
                            && fieldInfo.Array >= fieldDescription.array) { //making sure the fieldid in the csv file is not bogus
                        const valueType: string = fieldInfo.ValueType;
                        if (fieldInfo.Coding && (server.CODING_DICT as CodingMap)[fieldInfo.Coding]) {
                            fieldToBePushedToHeader.metadata = {
                                coding: (server.CODING_DICT as CodingMap)[fieldInfo.Coding],
                                valueType: UKBiobankValueTypes[valueType]
                            };
                        } else {
                            fieldToBePushedToHeader.metadata = {
                                valueType: UKBiobankValueTypes[valueType]
                            };
                        }
                        fieldToBePushedToHeader.fieldDescription = fieldDescription;
                        header.push(fieldToBePushedToHeader);
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
                const bulkInsert = Database.UKB_data_collection.initializeUnorderedBulkOp();
                for (let i = 1; i < line.length; i++) {
                    let entry;
                    if (line[i] !== null && line[i] !== '' && header[i] !== undefined) {
                        if (((header[i] as any).metadata as any).coding) {
                            const meaning = ((header[i] as any).metadata as any).coding[line[i]];
                            if (meaning !== undefined) {
                                entry = {
                                    eid,
                                    ...(header[i] as any).fieldDescription,
                                    value: meaning
                                };
                                bulkInsert.insert(entry);
                            } else {
                                if (isNaN(parseFloat(line[i]))) {
                                    console.log('CANNOT FIND MEANING', {
                                        eid,
                                        ...(header[i] as any).fieldDescription,
                                        value:line[i]
                                    });
                                } else {
                                    entry = {
                                        eid,
                                        ...(header[i] as any).fieldDescription,
                                        value: parseFloat(line[i])
                                    };
                                    bulkInsert.insert(entry);
                                }
                            }
                        } else {
                            entry = {
                                eid,
                                ...(header[i] as any).fieldDescription,
                                value: (((header[i] as any).metadata as any).valueType === 'integer' || ((header[i] as any).metadata as any).valueType === 'float') ? parseFloat(line[i]) : line[i]
                            };
                            bulkInsert.insert(entry);
                        }
                    }
                }
                bulkInsert.execute((err, result) => {
                    if (err) { console.log(err); return; };
                    if (lineNum == 502615) {
                        endTime = Date.now();
                        console.log(endTime - startTime);
                    }
                    console.log('result',result.nInserted, 'lineNum', ++lineNum);
                })
                numOfSubj++;
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