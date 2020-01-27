import csvparse from 'csv-parse';
import { Models } from 'itmat-commons';
import mongo, { Collection } from 'mongodb';
import { IFieldDescriptionObject, IHeaderArrayElement } from '../models/curationUtils';
import { ICodingMap } from '../models/UKBCoding';
import { UKBiobankValueTypes } from '../models/UKBDataType';
import { IFieldMap } from '../models/UKBFields';

export interface IDataEntry {
    m_jobId: string;
    m_eid: string;
    m_study: string;
    m_versionId: string;
    [field: string]: {
        [instance: string]: {
            [array: number]: number | string
        }
    } | string | boolean | string[];
}

/* update should be audit trailed */
/* eid is not checked whether it is unique in the file: this is assumed to be enforced by database */
export class UKBCSVCurator {
    /* variables prefixed with _ are used in curation and does not define the class */
    private _fieldNumber: number | undefined; // tslint:disable-line
    private _header: (IHeaderArrayElement | null)[]; // tslint:disable-line
    private _fieldsWithError: string[]; // tslint:disable-line
    private _numOfSubj: number; // tslint:disable-line
    private _headerProcessedSuccessfully: boolean; // tslint:disable-line
    private _headerProcessCalled: boolean; // tslint:disable-line

    constructor(
        // private readonly db: Database,
        private readonly dataCollection: Collection,
        private readonly jobsCollection: Collection,
        private readonly studyName: string,
        private readonly jobId: string,
        private readonly incomingWebStream: NodeJS.ReadableStream,
        private readonly _fieldDict: IFieldMap, // tslint:disable-line
        private readonly _codingDict: ICodingMap, // tslint:disable-line
        private readonly parseOptions: csvparse.Options = { delimiter: ',', quote: '"' }
    ) {
        this._header = [null]; // the first element is subject id
        this._fieldsWithError = [];
        this._numOfSubj = 0;
        this._headerProcessedSuccessfully = false;
        this._headerProcessCalled = false;
    }

    public async processIncomingStreamAndUploadToMongo(): Promise<void> {

        let lineNum = 0;
        let isHeader: boolean = true;
        let bulkInsert = this.dataCollection.initializeUnorderedBulkOp();
        const parseStream: NodeJS.ReadableStream = this.incomingWebStream.pipe(csvparse(this.parseOptions)); // piping the incoming stream to a parser stream

        // check for intergrity
        parseStream.on('data', async (line) => {
            if (isHeader) {
                /* pausing the stream so all the async ops on the first line must be completed before the second line is read */
                parseStream.pause();
                lineNum++;
                isHeader = false;
                await this.processHeader(line);

                // if (!this._headProcessedSuccessfully) { return; }
                parseStream.resume();  // now that all promises have resolved, we can resume the stream
            } else {
                const currentLineNum = lineNum++;
                /* no need to pause stream here because the calls to database don't need to follow any order */

                if (line.length !== this._fieldNumber) {
                    const error: string = Models.JobModels.jobTypes.UKB_CSV_UPLOAD.error.UNEVEN_FIELD_NUMBER(currentLineNum);
                    await this.setJobStatusToError(error);

                    (this.incomingWebStream as any).destroy();  // does this work?
                    return;
                }

                const entry: IDataEntry = await this.processLineAndFormatEntry({
                    m_in_qc: true,
                    m_eid: line[0],
                    m_jobId: this.jobId,
                    m_study: this.studyName
                }, line);

                bulkInsert.insert(entry);
                this._numOfSubj++;

                if (this._numOfSubj > 2000) {     // race condition?   // PROBLEM: the last bit <2000 doesn't get uploaded\
                    this._numOfSubj = 0;
                    await bulkInsert.execute((err: Error) => {
                        if (err) { console.error((err as any).writeErrors[1].err); return; }
                    });
                    bulkInsert = this.dataCollection.initializeUnorderedBulkOp();
                }
            }
        });

        parseStream.on('end', () => {
            bulkInsert.execute((err: Error) => {

                if (err) { console.error(err); return; }
            });

        });
    }

    private async processValue(headerElementForField: IHeaderArrayElement, preValue: string): Promise<string | number | false> {
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

    private async processHeader(line: string[]): Promise<void> {
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

    private async setJobStatusToError(errorMsg: string) {
        const updateResult: mongo.UpdateWriteOpResult = await this.jobsCollection.updateOne(
            { id: this.jobId },
            {
                $set:
                {
                    status: 'Finished',
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

    private async processLineAndFormatEntry(originalEntry: IDataEntry, line: string[]): Promise<IDataEntry> {
        const entry: any = Object.assign(originalEntry);

        for (let i = 1; i < line.length; i++) {
            if (line[i] === '' || this._header[i] === null || line[i] === null || this._header[i] === undefined) {
                continue;
            }

            const value: string | number | false = await this.processValue(this._header[i] as IHeaderArrayElement, line[i]);

            /************************HERE IS THE MAIN DIFFERENCE BETWEEN IMPLEMENTATIONS ******/
            const { field: { instance, fieldId, array } } = this._header[i] as IHeaderArrayElement;
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
            fieldId: parseInt(fieldHeader.slice(0, fieldHeader.indexOf('-')), 10),
            instance: parseInt(fieldHeader.slice(fieldHeader.indexOf('-') + 1, fieldHeader.indexOf('.')), 10),
            array: parseInt(fieldHeader.slice(fieldHeader.indexOf('.') + 1), 10)
        });
    }

    private checkFieldIsValid(field: IFieldDescriptionObject, fieldInfo: IFieldEntry | undefined): boolean {
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

    private async processValue_helper_testValueType(headerElementForField: IHeaderArrayElement, preValue: string): Promise<string | number | false> {
        if (headerElementForField.valueType === 'integer' || headerElementForField.valueType === 'float') {
            if (!isNaN(parseFloat(preValue))) {  // better ways to test isNan??..
                return parseFloat(preValue);
            } else {
                return preValue;
                //
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
