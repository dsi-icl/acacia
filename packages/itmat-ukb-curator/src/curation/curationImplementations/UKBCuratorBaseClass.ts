import csvparse from 'csv-parse';
import { UKBCurationDatabase } from '../../database/database';
import { ICodingMap } from '../../models/UKBCoding';
import { IFieldMap, IFieldEntry } from '../../models/UKBFields';
import { IFieldDescriptionObject, IHeaderArrayElement } from '../../models/curationUtils';
import { UKBiobankValueTypes } from '../../models/UKBDataType';
import { Models, CustomError } from 'itmat-utils';
import mongo from 'mongodb';


export interface IDataEntryBase {
    m_jobId: string,
    m_eid: string,
    m_study: string
}

/* update should be audit trailed */ 
/* eid is not checked whether it is unique in the file: this is assumed to be enforced by database */
export abstract class UKBCSVDataCuratorBase<entryType extends IDataEntryBase> {
    /* variables prefixed with _ are used in curation and does not define the class */
    protected _fieldNumber: number | undefined;
    protected _header: (IHeaderArrayElement|null)[];
    private readonly _fieldDict: IFieldMap;
    protected _fieldsWithError: string[];
    protected _numOfSubj: number;
    protected _headerProcessedSuccessfully: boolean;
    protected _headerProcessCalled: boolean;

    constructor(
        protected readonly jobId: string,
        protected readonly fileName: string,
        protected readonly incomingWebStream: NodeJS.ReadableStream,
        protected readonly parseOptions: csvparse.Options = { delimiter: ',', quote: '"' }
    ) {
        this._fieldDict = UKBCurationDatabase.FIELD_DICT;   //updated on database class
        this._header = [ null ]; //the first element is subject id
        this._fieldsWithError = [];
        this._numOfSubj = 0;
        this._headerProcessedSuccessfully = false;
        this._headerProcessCalled = false;
    }


    protected async processValue(headerElementForField: IHeaderArrayElement, preValue: string): Promise<string|number|false> {
        /* PRECONDITION: this.processHeader must be called */ 
        /* PRECONDITION: preValue is not null or empty string (checked in the enclosing function) */ 

        /* WHAT VALUE TO UPLOAD FOR EACH FIELD? (SPECIFIC TO UKB)
            = check whether the value is null, empty string
                ┗ check the field has coding or not
                    ┣ yes -> check whether the value is in the coding 
                    ┃   ┣ yes -> replace the value with the meaning in the coding
                    ┃   ┗ no -> check whether valuetype is integer or float
                    ┃       ┣ yes -> can parse the number?
                    ┃       ┃    ┣ yes -> parse to number and upload
                    ┃       ┃    ┗ no -> set job status to error and terminate.
                    ┃       ┗ no -> upload the string as is
                    ┗ no -> check whether the valuetype is integer or float
                        ┣ yes -> can parse the number?
                        ┃    ┣ yes -> parse to number and upload
                        ┃    ┗ no -> set job status to error and terminate.
                        ┗ no -> upload the string as is
        */
        if (!this._headerProcessCalled) {
            //log error to database 
            throw Error('Cannot call processValue before processHeader');
        }

        if (headerElementForField.coding !== undefined) {
            if (headerElementForField.coding[preValue] !== undefined) {
                return headerElementForField.coding[preValue];
            } else {
                return await this.processValue_helper_testValueType(headerElementForField, preValue);
            }
        } else {
            return await this.processValue_helper_testValueType(headerElementForField, preValue);
        }
    }

    private async processValue_helper_testValueType(headerElementForField: IHeaderArrayElement, preValue: string): Promise<string|number|false> {
        if (UKBiobankValueTypes[headerElementForField.valueType] === 'integer' || UKBiobankValueTypes[headerElementForField.valueType] === 'float') {
            if (!isNaN(preValue as any)) {  //better ways to test isNan??..
                return parseFloat(preValue);
            } else {
                console.log(headerElementForField, preValue);
                throw new CustomError('processValue_helper');
                // const error: string = Models.JobModels.jobTypes.UKB_CSV_UPLOAD.error.FIELD_ERROR(this._fieldsWithError);
                // await this.setJobStatusToError(error);
                // (this.incomingWebStream as any).destroy();  //does this work?
                return false;
            }
        } else {
            return preValue;
        }
    }

    protected async processHeader(line: string[]): Promise<void> {
        this._headerProcessCalled = true;
        this._fieldNumber = line.length; //saving the fieldNum to check each line has the same #column
        for (let el of line) { //starting from the second column
            const fieldDescription = this.parseFieldHeader(el);
            const fieldInfo = this._fieldDict[fieldDescription.fieldId];
            if (this.checkFieldIsValid(fieldDescription, fieldInfo)) { //making sure the fieldid in the csv file is not bogus
                this._header.push(Object.freeze(this.formatHeaderElement(fieldDescription, fieldInfo)));
            } else {
                this._header.push(null);
                this._fieldsWithError.push(el);
            }
        }
        if (this._fieldsWithError.length !== 0) {
            const error: string = Models.JobModels.jobTypes.UKB_CSV_UPLOAD.error.INVALID_FIELD(this._fieldsWithError);
            await this.setJobStatusToError(error);
            (this.incomingWebStream as any).destroy();  //does this work?
            return;
        }
        Object.freeze(this._header);
        this._headerProcessedSuccessfully = true;
        return;
    }

    protected async setJobStatusToError(errorMsg: string) {
        const updateResult: mongo.UpdateWriteOpResult = await UKBCurationDatabase.jobs_collection.updateOne(
            { id: this.jobId },
            { $set: 
                {
                    status: Models.JobModels.jobTypes.UKB_CSV_UPLOAD.status[4],
                    error: errorMsg
                }
            }
        );
        if (updateResult.modifiedCount === 1) {
            return;
        } else {
            ///TO_DO: log error to database 
            return;
        }
    }

    private parseFieldHeader(fieldHeader: string): IFieldDescriptionObject {
        return ({
                fieldId: parseInt(fieldHeader.slice(0, fieldHeader.indexOf('-'))),
                instance: parseInt(fieldHeader.slice(fieldHeader.indexOf('-')+1, fieldHeader.indexOf('.'))),
                array: parseInt(fieldHeader.slice(fieldHeader.indexOf('.')+1))
        });
    }

    private checkFieldIsValid(field: IFieldDescriptionObject, fieldInfo: IFieldEntry|undefined): boolean {
        return (fieldInfo !== undefined
            && field.fieldId === fieldInfo.FieldID
            && fieldInfo.Instances >= field.instance
            && fieldInfo.Array >= field.array);
    }

    private formatHeaderElement(field: IFieldDescriptionObject, fieldInfo: IFieldEntry): IHeaderArrayElement {
        //PRECONDITION: this.checkFieldIsValid has been run so fieldInfo must not be undefined.
        if (fieldInfo.Coding && UKBCurationDatabase.CODING_DICT[fieldInfo.Coding]) {
            return ({
                coding: UKBCurationDatabase.CODING_DICT[fieldInfo.Coding],
                valueType: UKBiobankValueTypes[fieldInfo.ValueType],
                totalArrayNumber: fieldInfo.Array,
                field
            });
        } else {
            return ({
                valueType: UKBiobankValueTypes[fieldInfo.ValueType],
                totalArrayNumber: fieldInfo.Array,
                field
            });
        }
    }

    protected abstract async processLineAndFormatEntry<entryType>(originalEntry: IDataEntryBase, line: string[]): Promise<entryType>;

    public async processIncomingStreamAndUploadToMongo(): Promise<void> {
        console.log(`uploading for job ${this.jobId}`);
        let lineNum = 0;
        let isHeader: boolean = true;
        let bulkInsert = UKBCurationDatabase.UKB_data_collection.initializeUnorderedBulkOp();
        const parseStream: NodeJS.ReadableStream = this.incomingWebStream.pipe(csvparse(this.parseOptions)); //piping the incoming stream to a parser stream

        //check for intergrity
        parseStream.on('data', async (line) => {
            if (isHeader) {
                /* pausing the stream so all the async ops on the first line must be completed before the second line is read */
                parseStream.pause();
                lineNum++;
                isHeader = false;
                await this.processHeader(line);
                console.log(this._headerProcessedSuccessfully, ' header process ', this._fieldsWithError);
                // if (!this._headProcessedSuccessfully) { return; }
                parseStream.resume();  //now that all promises have resolved, we can resume the stream
            } else {
                const currentLineNum = lineNum++;
                /* no need to pause stream here because the calls to database don't need to follow any order */

                // if (line.length !== this._fieldNumber) {
                //     const error: string = Models.JobModels.jobTypes.UKB_CSV_UPLOAD.error.UNEVEN_FIELD_NUMBER(currentLineNum);
                //     await this.setJobStatusToError(error);
                //     console.log('ERROR', 'uneven NF');
                //     (this.incomingWebStream as any).destroy();  //does this work?
                //     return;
                // }

                // const entry: entryType = await this.processLineAndFormatEntry<entryType>({ m_eid: line[0], m_jobId: this.jobId, m_study: "UKBIOBANK" }, line);

                // bulkInsert.insert(entry);
                this._numOfSubj++;
                console.log('lineNum', currentLineNum);
                // if (this._numOfSubj > 2000) {     //race condition?   //PROBLEM: the last bit <2000 doesn't get uploaded\
                //     this._numOfSubj = 0;
                //     bulkInsert.execute((err: Error, result) => {
                //         if (err) { console.log((err as any).writeErrors[1].err); return; };
                //     });
                //     bulkInsert = UKBCurationDatabase.UKB_data_collection.initializeUnorderedBulkOp();
                // }
            }
        });

        parseStream.on('end', () => {
            bulkInsert.execute((err: Error, result) => {
                if (err) { console.log((err as any).writeErrors[1].err); return; };
            });
            console.log('end');
        });
    }
}