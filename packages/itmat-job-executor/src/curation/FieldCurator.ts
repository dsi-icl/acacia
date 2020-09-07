import csvparse from 'csv-parse';
import { Collection } from 'mongodb';
import { Writable, Readable } from 'stream';
import { v4 as uuid } from 'uuid';
import { Models, IJobEntryForFieldCuration, IFieldEntry, enumValueType } from 'itmat-commons';

/* update should be audit trailed */
/* eid is not checked whether it is unique in the file: this is assumed to be enforced by database */

const CORRECT_NUMBER_OF_COLUMN = 11;

export class FieldCurator {
    private _errored: boolean;
    private _errors: string[];
    private _numOfFields: number;

    constructor(
        private readonly fieldCollection: Collection,
        private readonly incomingWebStream: Readable,
        private readonly parseOptions: csvparse.Options = { delimiter: '\t', quote: '"', relax_column_count: true, skip_lines_with_error: true },
        private readonly job: IJobEntryForFieldCuration,
        private readonly fieldTreeId: string
    ) {
        this._errored = false;
        this._errors = [];
        this._numOfFields = 0;
    }

    /* return list of errors. [] if no error */
    public processIncomingStreamAndUploadToMongo(): Promise<string[]> {
        /**
         *     fieldId  fieldName   valueType   possibleValues  unit    path    numOfTimePoints numOfMeasurements   startingTimepoint   startingMeasurement notes
         */
        return new Promise((resolve) => {
            console.log(`uploading for job ${this.job.id}`);
            const fieldIdString: string[] = [];
            let lineNum = 0;
            let isHeader = true;
            let bulkInsert = this.fieldCollection.initializeUnorderedBulkOp();
            const csvparseStream = csvparse(this.parseOptions);
            const parseStream = this.incomingWebStream.pipe(csvparseStream); // piping the incoming stream to a parser stream

            csvparseStream.on('skip', (error) => {
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
                            fieldTreeId: this.fieldTreeId
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
                            await bulkInsert.execute((err: Error) => {
                                if (err) { console.log((err as any).writeErrors[1].err); return; }
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
                    await bulkInsert.execute((err: Error) => {
                        console.log('FINSIHED LOADING');
                        if (err) { console.log(err); return; }
                    });
                }

                console.log('end');
                resolve(this._errors);
            });

            parseStream.pipe(uploadWriteStream);
        });
    }
}

export function processFieldRow({ lineNum, row, job, fieldTreeId }: { lineNum: number, row: string[], job: IJobEntryForFieldCuration, fieldTreeId: string }): { error?: string[], dataEntry: IFieldEntry } {
    /* pure function */
    const error: string[] = [];
    const dataEntry_nouse: any = {};
    const THESE_COL_CANT_BE_EMPTY = {
        0: 'FieldID',
        1: 'Field Name',
        2: 'Value Type',
        5: 'Path',
        6: 'Number of Time Points',
        7: 'Number of Measurements',
        8: 'Starting Time Point',
        9: 'Starting Measurement'
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
    if (!/^\d+$/.test(row[0]) && row[0] !== '') {
        error.push(`Line ${lineNum} column 1: Cannot parse field ID as number.`);
    }
    if (!/^\d+$/.test(row[6]) && row[6] !== '') {
        error.push(`Line ${lineNum} column 7: Cannot parse number of time points as number.`);
    }
    if (!/^\d+$/.test(row[7]) && row[7] !== '') {
        error.push(`Line ${lineNum} column 8: Cannot parse number of measurements as number.`);
    }
    if (!/^\d+$/.test(row[8]) && row[8] !== '') {
        error.push(`Line ${lineNum} column 9: Cannot parse starting timepoint as number.`);
    }
    if (!/^\d+$/.test(row[9]) && row[9] !== '') {
        error.push(`Line ${lineNum} column 10: Cannot parse starting measurement as number.`);
    }


    /* check the value type */
    if (!['c', 'd', 'i', 'b', 't'].includes(row[2])) {
        error.push(`Line ${lineNum} column 3: Invalid value type "${row[2]}": use "c" for categorical, "i" for integer, "d" for decimal, "b" for boolean and "t" for free text.`);
    }

    /* if valueType = C, then possibleValues cant be empty */
    if (row[2] === 'c' && row[3] === '') {
        error.push(`Line ${lineNum} column 4: "Possible values" cannot be empty if value type is categorical.`);
    }

    if (error.length !== 0) {
        return ({ error, dataEntry: dataEntry_nouse });
    }

    const fieldId = parseInt(row[0], 10);
    const numOfTimePoints = parseInt(row[6], 10);
    const numOfMeasurements = parseInt(row[7], 10);
    const startingTimePoint = parseInt(row[8], 10);
    const startingMeasurement = parseInt(row[9], 10);

    const dataEntry: IFieldEntry = {
        id: uuid(),
        studyId: job.studyId,
        path: row[5],
        fieldId,
        fieldName: row[1],
        valueType: row[2] as enumValueType,
        possibleValues: row[3] === '' ? undefined : row[3].split(','),
        unit: row[4],
        itemType: Models.Field.enumItemType.CLINICAL,
        numOfTimePoints,
        numOfMeasurements,
        startingTimePoint,
        startingMeasurement,
        notes: row[10],
        jobId: job.id,
        deleted: null,
        dateAdded: (new Date()).valueOf(),
        fieldTreeId
    };

    return ({ error: undefined, dataEntry });
}
