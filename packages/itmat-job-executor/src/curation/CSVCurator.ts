import csvparse from 'csv-parse';
import { Collection } from 'mongodb';
import { Writable, Readable } from 'stream';
import { IFieldDescriptionObject, IDataEntry, IJobEntry } from 'itmat-commons';
import { fieldValidator, fieldParser } from '../utils/jobUtils';

/* update should be audit trailed */
/* eid is not checked whether it is unique in the file: this is assumed to be enforced by database */
export class CSVCurator {
    /**
     * things to check:
     * - duplicate subject id
     * - duplicate field
     * - datatype mismatch
     * - uneven column number
     * - parse / encoding error
     */
    private _header: (IFieldDescriptionObject | null)[];
    private _numOfSubj: number;
    private _errored: boolean;
    private _errors: string[];

    constructor(
        private readonly dataCollection: Collection,
        private readonly incomingWebStream: Readable,
        private readonly parseOptions: csvparse.Options = { delimiter: '\t', quote: '"', relax_column_count: true, skip_lines_with_error: true },
        private readonly job: IJobEntry<{ dataVersion: string, versionTag?: string }>,
        private readonly versionId: string
    ) {
        this._header = [null]; // the first element is subject id
        this._numOfSubj = 0;
        this._errored = false;
        this._errors = [];
    }

    /* return list of errors. [] if no error */
    public processIncomingStreamAndUploadToMongo(): Promise<string[]> {
        return new Promise((resolve) => {
            console.log(`uploading for job ${this.job.id}`);
            let lineNum = 0;
            let isHeader = true;
            const subjectString: string[] = [];
            let bulkInsert = this.dataCollection.initializeUnorderedBulkOp();
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
                        lineNum++;
                        const { error, parsedHeader } = processHeader(line);
                        if (error) {
                            this._errored = true;
                            this._errors.push(...error);
                        }
                        this._header = parsedHeader;
                        isHeader = false;
                        next();
                    } else {
                        const currentLineNum = ++lineNum;
                        subjectString.push(line[0]);
                        const { error, dataEntry } = processDataRow({
                            lineNum: currentLineNum,
                            row: line,
                            parsedHeader: this._header,
                            job: this.job,
                            versionId: this.versionId
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
                        this._numOfSubj++;
                        if (this._numOfSubj > 999) {
                            this._numOfSubj = 0;
                            await bulkInsert.execute((err: Error) => {
                                if (err) { console.log((err as any).writeErrors[1].err); return; }
                            });
                            bulkInsert = this.dataCollection.initializeUnorderedBulkOp();
                        }
                        next();
                    }
                }
            });

            uploadWriteStream.on('finish', async () => {
                /* check for subject Id duplicate */
                const set = new Set(subjectString);
                if (set.size !== subjectString.length) {
                    this._errors.push('Data Error: There is duplicate subject id.');
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


export function processHeader(header: string[]): { error?: string[], parsedHeader: Array<IFieldDescriptionObject | null> } {
    /* pure function */
    /* headerline is ['eid', 1@0.0, 2@0.1:c] */
    /* returns a parsed object array and error (undefined if no error) */

    const fieldstrings: string[] = [];
    const error: string[] = [];
    const parsedHeader: Array<IFieldDescriptionObject | null> = Array(header.length);
    let colNum = 0;
    for (const each of header) {
        if (colNum === 0) {
            parsedHeader[0] = null;
        } else {
            if (!fieldValidator(each)) {
                error.push(`Line 1: '${each}' is not a valid header field descriptor.`);
                parsedHeader[colNum] = null;
            } else {
                const { fieldId, timepoint, measurement, datatype } = fieldParser(each);
                parsedHeader[colNum] = { fieldId, timepoint, measurement, datatype };
                fieldstrings.push(`${fieldId}.${timepoint}.${measurement}`);
            }
        }
        colNum++;
    }

    /* check for duplicate */
    const set = new Set(fieldstrings);
    if (set.size !== fieldstrings.length) {
        error.push('Line 1: There is duplicate (field, timepoint, measurement) combination.');
    }

    return ({ parsedHeader, error: error.length === 0 ? undefined : error });
}

export function processDataRow({ lineNum, row, parsedHeader, job, versionId }: { versionId: string, lineNum: number, row: string[], parsedHeader: Array<IFieldDescriptionObject | null>, job: IJobEntry<{ dataVersion: string, versionTag?: string }> }): { error?: string[], dataEntry: Partial<IDataEntry> } {
    /* pure function */
    const error: string[] = [];
    let colIndex = 0;
    const dataEntry: any = {
        m_jobId: job.id,
        m_study: job.studyId,
        m_versionId: versionId
    };

    if (row.length !== parsedHeader.length) {
        error.push(`Line ${lineNum}: Uneven field Number; expected ${parsedHeader.length} fields but got ${row.length}`);
        return ({ error, dataEntry });
    }

    for (const each of row) {
        if (colIndex === 0) {
            /* extracting subject id */
            if (each === '') {
                error.push(`Line ${lineNum}: No subject id provided.`);
                colIndex++;
                continue;
            }
            dataEntry.m_eid = each;
            colIndex++;
            continue;
        }

        /* skip for missing data */
        if (each === '') {
            colIndex++;
            continue;
        }

        if (parsedHeader[colIndex] === null) {
            colIndex++;
            continue;
        }
        const { fieldId, timepoint, measurement, datatype } = parsedHeader[colIndex] as IFieldDescriptionObject;

        /* adding value to dataEntry */
        let value: any;
        try {
            switch (datatype) {
                case 'c': // categorical
                    value = each;
                    break;
                case 'd': // decimal
                    if (!/^\d+(.\d+)?$/.test(each)) {
                        error.push(`Line ${lineNum} column ${colIndex + 1}: Cannot parse '${each}' as decimal.`);
                        colIndex++;
                        continue;
                    }
                    value = parseFloat(each);
                    break;
                case 'i': // integer
                    if (!/^\d+$/.test(each)) {
                        error.push(`Line ${lineNum} column ${colIndex + 1}: Cannot parse '${each}' as integer.`);
                        colIndex++;
                        continue;
                    }
                    value = parseInt(each, 10);
                    break;
                case 'b': // boolean
                    if (each.toLowerCase() === 'true' || each.toLowerCase() === 'false') {
                        value = each.toLowerCase() === 'true';
                    } else {
                        error.push(`Line ${lineNum} column ${colIndex + 1}: value for boolean type must be 'true' or 'false'.`);
                        colIndex++;
                        continue;
                    }
                    break;
                case 't':
                    value = each;
                    break;
                default:
                    error.push(`Line ${lineNum}: Invalid data type '${datatype}'`);
                    colIndex++;
                    continue;
            }
        } catch (e) {
            error.push(e.toString());
            continue;
        }

        if (dataEntry[fieldId] === undefined) {
            dataEntry[fieldId] = {};
        }
        if (dataEntry[fieldId][timepoint] === undefined) {
            dataEntry[fieldId][timepoint] = {};
        }
        dataEntry[fieldId][timepoint][measurement] = value;
        colIndex++;
    }

    return ({ error: error.length === 0 ? undefined : error, dataEntry });
}
