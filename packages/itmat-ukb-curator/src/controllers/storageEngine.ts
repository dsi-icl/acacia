/* storage engine for multer */
import express from 'express';
import Papa from 'papaparse';
import multer from 'multer';
import { Database } from 'itmat-utils';
import { UKBFields, FieldEntry } from '../curation/UKBFields';
import { UKBCoding } from '../curation/UKBCoding';

const parseOptions: Papa.ParseConfig = {
    delimiter: ',',
    quoteChar: '"',
    header: false,
    trimHeaders: true,
    encoding: "utf-8",
};

interface fieldDescription {
    fieldId: number,
    instance: number,
    array: number
}

interface headerArrayElement {
    fieldDescription: fieldDescription,
    metadata?: {
        coding: undefined | number,
        valueType: string
    }
}

const UKBiobankValueTypes = {   // 'date' are provided in yyyy-mm-dd;
    Integer: 'integer',
    'Categorical single': 'categorical single',
    'Categorical multiple': 'categorical multiple',
    Compound: 'compound',
    Date: 'date',
    Text: 'text',
    Continuous: 'float',
    Time: 'date'
}

/* batch insert, saving codings to memory */ 

class _CSVStorageEngine implements multer.StorageEngine {
    public _handleFile(req: express.Request, file: any, cb: (error?: any, info?: object) => void): void {
        const incomingStream = file.stream;
        let isHeader = true;
        let numOfSubj = 0;
        let startTime: number;
        let endTime: number;
        let fieldNumber: number;
        const fieldsWithError: string[] = [];
        const header: headerArrayElement[] = [{ fieldDescription: {fieldId: -999999, instance: -999999, array: -999999}} ];  //the first element is subject id
        const parseStream: NodeJS.ReadableStream = incomingStream.pipe(Papa.parse(Papa.NODE_STREAM_INPUT, parseOptions)); //piping the incoming stream to a parser stream

        parseStream.on('data', async (line: string[]) => {
            if (isHeader) {
                startTime = Date.now();
                /* pausing the stream so all the async ops on the first line must be completed before the second line is read */
                parseStream.pause();
                fieldNumber = line.length; //saving the fieldNum to check each line has the same #column
                const promiseArr = [];
                isHeader = false;
                for (let i = 1; i < line.length; i++) { //starting from the second column
                    const el = line[i];
                    const fieldDescription = {    //add in data provenance and user too;
                        fieldId: parseInt(el.slice(0, el.indexOf('-'))),
                        instance: parseInt(el.slice(el.indexOf('-')+1, el.indexOf('.'))),
                        array: parseInt(el.slice(el.indexOf('.')+1))
                    };
                    header.push({fieldDescription});
                    promiseArr.push(UKBFields.getFieldInfo(fieldDescription.fieldId));
                }
                const results = await Promise.all(promiseArr);  //all promises need to be resolved before resuming stream because the following rows of csv depend on info of the header
                for(let j = 0; j < results.length; j++) {
                    if (results[j] && results[j].Instances >= header[j+1].fieldDescription.instance && results[j].Array >= header[j+1].fieldDescription.array) { //making sure the fieldid in the csv file is not bogus
                        const valueType: string = results[j].ValueType;
                        const coding: undefined | number = results[j].Coding === null ? undefined : (results[j].Coding as number);
                        header[j+1].metadata = {
                            coding,
                            valueType: (UKBiobankValueTypes as any)[valueType]
                        }
                    } else {
                        fieldsWithError.push(line[j+1]);
                    }
                };
                parseStream.resume();  //now that all promises have resolved, we can resume the stream
            } else {
                /* no need to pause stream here because the calls to database don't need to follow any order */
                if (line.length !== fieldNumber) {
                    throw Error('column number doesnt match');
                }
                const eid = parseInt(line[0]);
                for (let i = 1; i < line.length; i++) {
                    let entry;
                    if (line[i] !== null && line[i] !== '') {
                        if ((header[i].metadata as any).coding) {
                            const meaning = await UKBCoding.getCodeMeaning((header[i].metadata as any).coding, line[i]);
                            if (meaning !== null) {
                                entry = {
                                    eid,
                                    ...header[i].fieldDescription,
                                    value: meaning
                                };
                                await Database.UKB_data_collection.insertOne(entry);
                            } else {
                                if (isNaN(parseFloat(line[i]))) {
                                    console.log('CANNOT FIND MEANING', {
                                        eid,
                                        ...header[i].fieldDescription,
                                        value:line[i]
                                    });
                                } else {
                                    entry = {
                                        eid,
                                        ...header[i].fieldDescription,
                                        value: parseFloat(line[i])
                                    };
                                    await Database.UKB_data_collection.insertOne(entry);
                                }
                            }
                        } else {
                            entry = {
                                eid,
                                ...header[i].fieldDescription,
                                value: ((header[i].metadata as any).valueType === 'integer' || (header[i].metadata as any).valueType === 'float') ? parseFloat(line[i]) : line[i]
                            };
                            await Database.UKB_data_collection.insertOne(entry);
                        }
                    }
                }
                numOfSubj++;
            }
        });

        parseStream.on('end', () => { 
            endTime = Date.now();
            console.log(endTime - startTime);
            cb(null, { numOfSubj, fieldsWithError }); 
        } )
    }

    public _removeFile(req: express.Request, file: any, callback: (error: Error) => void): void {

    }
    
}

export const CSVStorageEngine = Object.freeze(new _CSVStorageEngine());