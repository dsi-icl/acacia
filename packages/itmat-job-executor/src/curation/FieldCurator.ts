import * as csvparse from 'csv-parse';
import { Collection } from 'mongodb';
import { Writable, Readable } from 'stream';
import { v4 as uuid } from 'uuid';
import { IJobEntryForFieldCuration, IFieldEntry, enumValueType } from '@itmat-broker/itmat-types';

/* update should be audit trailed */
/* eid is not checked whether it is unique in the file: this is assumed to be enforced by database */

const CORRECT_NUMBER_OF_COLUMN = 33;

export class FieldCurator {
    private _errored: boolean;
    private _errors: string[];
    private _numOfFields: number;

    constructor(
        private readonly fieldCollection: Collection,
        private readonly incomingWebStream: Readable,
        private readonly parseOptions: csvparse.Options = { delimiter: ',', quote: '"', relax_column_count: true, skip_records_with_error: true },
        private readonly job: IJobEntryForFieldCuration,
        private readonly codesObj: any
    ) {
        this._errored = false;
        this._errors = [];
        this._numOfFields = 0;
    }

    /* return list of errors. [] if no error */
    public async processIncomingStreamAndUploadToMongo(): Promise<string[]> {
        /**
         *     ID	Database	TableName	TableID	SequentialOrder	QuestionNumber	Fieldname	Label	Label_DE	Label_NL	Label_IT	Label_ES	Label_PL
         *     Label_F	EligibleAnswer	IneligibleAnswer	Validation	DataType	ControlType	SystemGenerated	ValueList	Length	DisplayFormat	Nullable	Required
         *     Mandatory	CollectIf	NotMapped	DefaultValue	RegEx	RegExErrorMsg	ShowOnIndexView	Comments
         */
        return new Promise((resolve) => {
            const fieldIdString: string[] = [];
            let lineNum = 0;
            let isHeader = true;
            let bulkInsert = this.fieldCollection.initializeUnorderedBulkOp();
            const csvparseStream = csvparse.parse(this.parseOptions);
            const parseStream = this.incomingWebStream.pipe(csvparseStream); // piping the incoming stream to a parser stream

            csvparseStream.on('skip', (error: any) => {
                lineNum++;
                this._errored = true;
                this._errors.push(error.toString());
            });

            const uploadWriteStream: NodeJS.WritableStream = new Writable({
                objectMode: true,
                write: async (line, _, next) => {
                    if (isHeader) {
                        if (line.length !== CORRECT_NUMBER_OF_COLUMN) {
                            this._errored = true;
                            this._errors.push(`Line ${lineNum}: expected ${CORRECT_NUMBER_OF_COLUMN} fields but got ${line.length}`);
                        }
                        isHeader = false;
                        lineNum++;
                        next();
                    } else {
                        const currentLineNum = ++lineNum;
                        fieldIdString.push(line[0]);
                        const { error, dataEntry } = processFieldRow({
                            lineNum: currentLineNum,
                            row: line,
                            job: this.job,
                            codes: this.codesObj
                        });

                        if (error) {
                            this._errored = true;
                            this._errors.push(...error);
                        }

                        if (this._errored) {
                            next();
                            return;
                        }

                        // // TO_DO {
                        //     curator-defined constraints for values
                        // }

                        bulkInsert.insert(dataEntry);
                        this._numOfFields++;
                        if (this._numOfFields > 999) {
                            this._numOfFields = 0;
                            await bulkInsert.execute().catch((err) => {
                                if (err) {
                                    //TODO Handle error recording
                                    console.error(err);
                                }
                            });
                            bulkInsert = this.fieldCollection.initializeUnorderedBulkOp();
                        }
                        next();
                    }
                }
            });

            uploadWriteStream.on('finish', async () => {
                /* check for subject Id duplicate */
                const set = new Set(fieldIdString);
                if (set.size !== fieldIdString.length) {
                    this._errors.push('Data Error: There is duplicate field id.');
                    this._errored = true;
                }

                if (!this._errored) {
                    await bulkInsert.execute().catch((err) => {
                        if (err) {
                            //TODO Handle error recording
                            console.error(err);
                        }
                    });
                }

                resolve(this._errors);
            });

            parseStream.pipe(uploadWriteStream);
        });
    }
}

export function processFieldRow({ lineNum, row, job, codes }: { lineNum: number, row: string[], job: IJobEntryForFieldCuration, codes: any }): { error?: string[], dataEntry: IFieldEntry } {
    /* pure function */
    const error: string[] = [];
    const dataEntry_nouse: any = {};
    const THESE_COL_CANT_BE_EMPTY: Record<number, string> = {
        0: 'FieldID',
        6: 'Field Name',
        17: 'Data Type'
    };
    if (row.length !== CORRECT_NUMBER_OF_COLUMN) {
        error.push(`Line ${lineNum}: Uneven field Number; expected ${CORRECT_NUMBER_OF_COLUMN} fields but got ${row.length}.`);
        return ({ error, dataEntry: dataEntry_nouse });
    }

    for (let i = 0; i < row.length; i++) {
        if (THESE_COL_CANT_BE_EMPTY[i] !== undefined && row[i] === '') {
            error.push(`Line ${lineNum} column ${i + 1}: ${THESE_COL_CANT_BE_EMPTY[i]} cannot be empty.`);
            continue;
        }
    }

    /* these fields has to be numbers */
    // fieldId should not be ''
    if (!/^\d+$/.test(row[0]) && row[0]) {
        error.push(`Line ${lineNum} column 1: Cannot parse field ID as number.`);
    }
    if (!/^\d+$/.test(row[21]) && row[21] !== '') {
        error.push(`Line ${lineNum} column 22: Cannot parse length of characters as number.`);
    }

    /* check the value type */
    const dataTypeNames: Record<string, enumValueType> = {
        int: enumValueType.INTEGER,
        decimal: enumValueType.DECIMAL,
        nvarchar: enumValueType.STRING,
        varchar: enumValueType.STRING,
        datetime: enumValueType.DATETIME,
        bit: enumValueType.BOOLEAN,
        json: enumValueType.JSON,
        file: enumValueType.FILE,
        categorical: enumValueType.CATEGORICAL
    };

    // datatypes: if fieldid exist in codes, then convert datatype to categorical
    let dataType;
    let possibleValues: any[] = [];
    if (codes[row[0].toString()] !== undefined) {
        dataType = dataTypeNames.categorical;
        possibleValues = codes[row[0].toString()];
    } else {
        dataType = dataTypeNames[Object.keys(dataTypeNames).filter(el => row[17].toUpperCase().indexOf(el.toUpperCase()) >= 0)[0]];
    }
    if (!(Object.keys(dataTypeNames).some(x => row[17].toUpperCase().indexOf(x.toUpperCase()) >= 0))) {
        error.push(`Line ${lineNum} column 18: Invalid value type "${row[2]}": use "int" for integers, "decimal()" for decimals, "nvarchar/varchar" for characters/strings, "datetime" for date time, "bit" for bit.`);
    }

    /* if valueType = C, then possibleValues cant be empty */
    // if (row[2] === 'c' && row[3] === '') {
    //     error.push(`Line ${lineNum} column 4: "Possible values" cannot be empty if value type is categorical.`);
    // }

    if (error.length !== 0) {
        return ({ error, dataEntry: dataEntry_nouse });
    }


    const dataEntry: IFieldEntry = {
        id: uuid(),
        studyId: job.studyId,
        fieldId: row[0],
        fieldName: row[6],
        tableName: row[2],
        dataType: dataType,
        possibleValues: possibleValues,
        unit: '',
        comments: row[32],
        dateAdded: (new Date()).toISOString(),
        dateDeleted: null,
        dataVersion: null
    };

    return ({ error: undefined, dataEntry });
}
