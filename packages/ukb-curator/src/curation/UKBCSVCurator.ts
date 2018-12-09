import csvparse from 'csv-parse';
import { ICodingMap } from '../models/UKBCoding';
import { IFieldMap, IFieldEntry } from '../models/UKBFields';
import { IFieldDescriptionObject, IHeaderArrayElement } from '../models/curationUtils';
import { UKBiobankValueTypes } from '../models/UKBDataType';
import { Models, CustomError } from 'itmat-utils';
import mongo, { Collection } from 'mongodb';

export interface IDataEntry {
    m_jobId: string,
    m_eid: string,
    m_study: string,
    m_in_qc: boolean,
    [field: string]: {
        [instance: string]: {
            [array: number]: number | string
        }
    } | string | boolean
}

/* update should be audit trailed */
/* eid is not checked whether it is unique in the file: this is assumed to be enforced by database */
export class UKBCSVCurator {
    /* variables prefixed with _ are used in curation and does not define the class */
    protected _fieldNumber: number | undefined; // tslint:disable-line
    protected _header: (IHeaderArrayElement | null)[]; // tslint:disable-line
    protected _fieldsWithError: string[]; // tslint:disable-line
    protected _numOfSubj: number; // tslint:disable-line
    protected _headerProcessedSuccessfully: boolean; // tslint:disable-line
    protected _headerProcessCalled: boolean; // tslint:disable-line

    constructor(
        // private readonly db: Database,
        private readonly dataCollection: Collection,
        private readonly jobsCollection: Collection,
        protected readonly jobId: string,
        protected readonly fileName: string,
        protected readonly incomingWebStream: NodeJS.ReadableStream,
        private readonly _fieldDict: IFieldMap, // tslint:disable-line
        private readonly _codingDict: ICodingMap, // tslint:disable-line
        protected readonly parseOptions: csvparse.Options = { delimiter: ',', quote: '"' }
    ) {
        this._header = [ null ]; // the first element is subject id
        this._fieldsWithError = [];
        this._numOfSubj = 0;
        this._headerProcessedSuccessfully = false;
        this._headerProcessCalled = false;
    }

    public async processIncomingStreamAndUploadToMongo(): Promise<void> {
        console.log(`uploading for job ${this.jobId}`);
        let lineNum = 0;
        let isHeader: boolean = true;
        let bulkInsert = this.dataCollection.initializeUnorderedBulkOp();
        const parseStream: NodeJS.ReadableStream = this.incomingWebStream.pipe(csvparse(this.parseOptions)); // piping the incoming stream to a parser stream

        // check for intergrity
        parseStream.on('data', async line => {
            if (isHeader) {
                /* pausing the stream so all the async ops on the first line must be completed before the second line is read */
                parseStream.pause();
                lineNum++;
                isHeader = false;
                await this.processHeader(line);
                console.log(this._headerProcessedSuccessfully, ' header process ', this._fieldsWithError);
                // if (!this._headProcessedSuccessfully) { return; }
                parseStream.resume();  // now that all promises have resolved, we can resume the stream
            } else {
                const currentLineNum = lineNum++;
                /* no need to pause stream here because the calls to database don't need to follow any order */

                if (line.length !== this._fieldNumber) {
                    const error: string = Models.JobModels.jobTypes.UKB_CSV_UPLOAD.error.UNEVEN_FIELD_NUMBER(currentLineNum);
                    await this.setJobStatusToError(error);
                    console.log('ERROR', 'uneven NF');
                    (this.incomingWebStream as any).destroy();  // does this work?
                    return;
                }

                const entry: IDataEntry = await this.processLineAndFormatEntry({ m_in_qc: true, m_eid: line[0], m_jobId: this.jobId, m_study: 'UKBIOBANK' }, line);

                bulkInsert.insert(entry);
                this._numOfSubj++;
                console.log('lineNum', currentLineNum);
                if (this._numOfSubj > 2000) {     // race condition?   // PROBLEM: the last bit <2000 doesn't get uploaded\
                    this._numOfSubj = 0;
                    bulkInsert.execute((err: Error) => {
                        if (err) { console.log((err as any).writeErrors[1].err); return; }
                    });
                    bulkInsert = this.dataCollection.initializeUnorderedBulkOp();
                }
            }
        });

        parseStream.on('end', () => {
            bulkInsert.execute((err: Error) => {
                console.log('FINSIHED LOADING');
                if (err) { console.log(err); return; }
            });
            console.log('end');
        });
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
            // log error to database
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

    protected async processHeader(line: string[]): Promise<void> {
        this._headerProcessCalled = true;
        this._fieldNumber = line.length; // saving the fieldNum to check each line has the same #column
        for (let i = 1, length = this._fieldNumber; i < length; i++) { // starting from the second column
            const fieldDescription = this.parseFieldHeader(line[i]);
            const fieldInfo = this._fieldDict[fieldDescription.fieldId];
            if (this.checkFieldIsValid(fieldDescription, fieldInfo)) { // making sure the fieldid in the csv file is not bogus
                this._header.push(Object.freeze(this.formatHeaderElement(fieldDescription, fieldInfo)));
            } else {
                this._header.push(null);
                this._fieldsWithError.push(line[i]);
            }
        }
        // if (this._fieldsWithError.length !== 0) {
        //     const error: string = Models.JobModels.jobTypes.UKB_CSV_UPLOAD.error.INVALID_FIELD(this._fieldsWithError);
        //     await this.setJobStatusToError(error);
        //     (this.incomingWebStream as any).destroy();  //does this work?
        //     return;
        // }
        Object.freeze(this._header);
        this._headerProcessedSuccessfully = true;
        return;
    }

    protected async setJobStatusToError(errorMsg: string) {
        const updateResult: mongo.UpdateWriteOpResult = await this.jobsCollection.updateOne(
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
            /// TO_DO: log error to database
            return;
        }
    }

    protected async processLineAndFormatEntry(originalEntry: IDataEntry, line: string[]): Promise<IDataEntry> {
        const entry: any = Object.assign(originalEntry);

        for (let i = 1; i < line.length; i++) {
            if (line[i] === '' || this._header[i] === null || line[i] === null || this._header[i] === undefined ) {
                continue;
            }

            const value: string | number | false = await this.processValue(this._header[i] as IHeaderArrayElement, line[i]);
            const fieldDescription: IHeaderArrayElement = this._header[i] as IHeaderArrayElement;

            /************************HERE IS THE MAIN DIFFERENCE BETWEEN IMPLEMENTATIONS ******/
            const { field: { instance, fieldId, array }, totalArrayNumber  } = this._header[i] as IHeaderArrayElement;
            if (entry[fieldId] === undefined) {
                entry[fieldId] = {};
            }

            /**
             * 1. check if entry[fieldId][instance] is defined
             * 2. check if entry[fieldId][instance][array] is defined
             *      if not then add the entry
             *      if yes then error
             */

            if (entry[fieldId][instance] === undefined) {
                entry[fieldId][instance] = { [array]: value };
                continue;
            } else if (entry[fieldId][instance][array] === undefined) {
                entry[fieldId][instance][array] = value;
            } else {
                throw Error; // duplicate value
            }
            /**********************************************************************************/
        }

        return entry;
    }

    private parseFieldHeader(fieldHeader: string): IFieldDescriptionObject {
        return ({
                fieldId: parseInt(fieldHeader.slice(0, fieldHeader.indexOf('-'))),
                instance: parseInt(fieldHeader.slice(fieldHeader.indexOf('-') + 1, fieldHeader.indexOf('.'))),
                array: parseInt(fieldHeader.slice(fieldHeader.indexOf('.') + 1))
        });
    }

    private checkFieldIsValid(field: IFieldDescriptionObject, fieldInfo: IFieldEntry|undefined): boolean {
        return (fieldInfo !== undefined
            && field.fieldId === fieldInfo.FieldID
            && fieldInfo.Instances >= field.instance
            && fieldInfo.Array >= field.array);
    }

    private formatHeaderElement(field: IFieldDescriptionObject, fieldInfo: IFieldEntry): IHeaderArrayElement {
        // PRECONDITION: this.checkFieldIsValid has been run so fieldInfo must not be undefined.
        if (fieldInfo.Coding && this._codingDict[fieldInfo.Coding]) {
            return ({
                coding: this._codingDict[fieldInfo.Coding],
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

    private async processValue_helper_testValueType(headerElementForField: IHeaderArrayElement, preValue: string): Promise<string|number|false> {
        if (headerElementForField.valueType === 'integer' || headerElementForField.valueType === 'float') {
            if (!isNaN(parseFloat(preValue))) {  // better ways to test isNan??..
                return parseFloat(preValue);
            } else {
                return preValue;
                // console.log(headerElementForField, preValue);
                // throw new CustomError('processValue_helper');
                // const error: string = Models.JobModels.jobTypes.UKB_CSV_UPLOAD.error.FIELD_ERROR(this._fieldsWithError);
                // await this.setJobStatusToError(error);
                // (this.incomingWebStream as any).destroy();  //does this work?
                return false;
            }
        } else {
            return preValue;
        }
    }

}