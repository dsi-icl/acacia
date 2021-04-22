import csvparse from 'csv-parse';
import { Collection } from 'mongodb';
import { Writable, Readable } from 'stream';
import { IFieldDescriptionObject, IDataEntry, IJobEntry } from 'itmat-commons';
import { fieldValidator, fieldParser } from '../utils/jobUtils';
import { parse } from 'querystring';

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
    private _subjectIdIndex: number;
    private _visitIdIndex: number;

    constructor(
        private readonly dataCollection: Collection,
        private readonly incomingWebStream: Readable,
        private readonly parseOptions: csvparse.Options = { delimiter: ',', quote: '"', relax_column_count: true, skip_lines_with_error: true },
        private readonly job: IJobEntry<{ dataVersion: string, versionTag?: string }>,
        private readonly versionId: string,
        private readonly fileId: string,
        private readonly fieldsList: any[]
    ) {
        this._header = [null]; // the first element is subject id
        this._numOfSubj = 0;
        this._errored = false;
        this._errors = [];
        this._subjectIdIndex = 0;
        this._visitIdIndex = 0;
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
                        const { error, parsedHeader, subjectIdIndex, visitIdIndex } = processHeader(line, this.fieldsList);
                        if (error) {
                            this._errored = true;
                            this._errors.push(...error);
                        }
                        this._header = parsedHeader;
                        this._subjectIdIndex = subjectIdIndex;
                        this._visitIdIndex = visitIdIndex;
                        isHeader = false;
                        next();
                    } else {
                        const currentLineNum = ++lineNum;
                        subjectString.push(line[0]);
                        const { error, dataEntry } = processDataRow({
                            subjectIdIndex: this._subjectIdIndex,
                            visitIdIndex: this._visitIdIndex,
                            lineNum: currentLineNum,
                            row: line,
                            parsedHeader: this._header,
                            job: this.job,
                            versionId: this.versionId,
                            fileId: this.fileId
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
                        const matchObj = {
                            m_subjectId: dataEntry.m_subjectId,
                            m_visitId: dataEntry.m_visitId,
                            m_versionId: dataEntry.m_versionId,
                            m_studyId: dataEntry.m_studyId
                        }
                        bulkInsert.insert(dataEntry);
                        // bulkInsert.find(matchObj).upsert().updateOne({$setOnInsert: dataEntry});
                        // bulkInsert.find(matchObj).upsert().updateOne(dataEntry);
                        
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
                // const set = new Set(subjectString);
                // if (set.size !== subjectString.length) {
                //     this._errors.push('Data Error: There is duplicate subject id.');
                //     this._errored = true;
                // }

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


export function processHeader(header: string[], fieldsList: any[]): { error?: string[], parsedHeader: any[], subjectIdIndex: number, visitIdIndex: number } {
    /* pure function */
    /* headerline is ['eid', 1@0.0, 2@0.1:c] */
    /* returns a parsed object array and error (undefined if no error) */

    // const fieldstrings: string[] = [];
    const error: string[] = [];
    const parsedHeader: any[] = Array(header.length);
    let colNum = 0;
    const fields: string[] = []
    const validatedFieldNames = fieldsList.map(el => el.fieldName);
    for (const each of header) {
        if (colNum === 0) {
            colNum++;
            continue;
        } else if (each === null || each === undefined || each === '') {
            continue;
        } else {
            if (validatedFieldNames.includes(each)) {
                fields.push(each);
                parsedHeader.push(fieldsList.filter(el => el.fieldName === each)[0]);
                
            } else {
                error.push(`Line 1: '${each}' is not a valid header field descriptor.`);
                parsedHeader[colNum] = null;         
            }
        }
        colNum++;
    }

    /* check for duplicate */
    const set = new Set(fields);
    if (set.size !== fields.length) {
        error.push('Line 1: There is duplicate (field, timepoint, measurement) combination.');
    }
    // get unique pair subjectid-visitid
    const filteredParsedHeader = parsedHeader.filter(el => el !== undefined);
    console.log(filteredParsedHeader);
    console.log(filteredParsedHeader.length);
    const subjectIdIndex = filteredParsedHeader.findIndex(el => el.fieldName === 'SubjectID') + 1; // ID is the first
    const visitIdIndex = filteredParsedHeader.findIndex(el => el.fieldName === 'VisitID') + 1;
    console.log(subjectIdIndex);
    console.log(visitIdIndex);

    return ({ parsedHeader: filteredParsedHeader, error: error.length === 0 ? undefined : error , subjectIdIndex, visitIdIndex});
}

export function processDataRow({ subjectIdIndex, visitIdIndex, lineNum, row, parsedHeader, job, versionId, fileId }: { subjectIdIndex: number, visitIdIndex: number, fileId: string, versionId: string, lineNum: number, row: string[], parsedHeader: any[], job: IJobEntry<{ dataVersion: string, versionTag?: string }> }): { error?: string[], dataEntry: Partial<IDataEntry> } {
    /* pure function */
    const error: string[] = [];
    let colIndex = 0;
    const dataEntry: any = {
        m_jobId: job.id,
        m_study: job.studyId,
        m_versionId: versionId,
        m_fileId: fileId
    };

    // if (row.length !== parsedHeader.filter(el => el !== undefined).length) {
    //     error.push(`Line ${lineNum}: Uneven field Number; expected ${parsedHeader.length} fields but got ${row.length}`);
    //     return ({ error, dataEntry });
    // }
    for (const each of row) {
        if (colIndex === 0) {
            /* extracting subject id */
            // if (each === '') {
            //     error.push(`Line ${lineNum}: No subject id provided.`);
            //     colIndex++;
            //     continue;
            // }
            // dataEntry.m_eid = each;
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

        if (colIndex === subjectIdIndex) {
            dataEntry.m_subjectId = each; 
            colIndex++;
            continue;
        }

        if (colIndex === visitIdIndex) {
            dataEntry.m_visitId = each; 
            colIndex++;
            continue;
        }
        const { fieldId, dataType } = parsedHeader[colIndex];

        /* adding value to dataEntry */
        let value: any;
        try {
            switch (dataType) {
                // case 'c': // categorical
                //     value = each;
                //     break;
                case 'dec': // decimal
                    if (!/^\d+(.\d+)?$/.test(each)) {
                        error.push(`Line ${lineNum} column ${colIndex + 1}: Cannot parse '${each}' as decimal.`);
                        colIndex++;
                        continue;
                    }
                    value = parseFloat(each);
                    break;
                case 'int': // integer
                    if (!/^\d+$/.test(each)) {
                        error.push(`Line ${lineNum} column ${colIndex + 1}: Cannot parse '${each}' as integer.`);
                        colIndex++;
                        continue;
                    }
                    value = parseInt(each, 10);
                    break;
                case 'bit': // boolean
                    if (each.toLowerCase() === 'true' || each.toLowerCase() === 'false') {
                        value = each.toLowerCase() === 'true';
                    } else {
                        error.push(`Line ${lineNum} column ${colIndex + 1}: value for boolean type must be 'true' or 'false'.`);
                        colIndex++;
                        continue;
                    }
                    break;
                case 'cha':
                    value = each.toString();
                    break;
                case 'dat':
                    value = each.toString();
                    break;
                default:
                    error.push(`Line ${lineNum}: Invalid data type '${dataType}'`);
                    colIndex++;
                    continue;
            }
        } catch (e) {
            error.push(e.toString());
            continue;
        }

        if (dataEntry[fieldId] === undefined) {
            dataEntry[fieldId] = null;
        }
        dataEntry[fieldId] = value;
        colIndex++;
    }

    return ({ error: error.length === 0 ? undefined : error, dataEntry });
}
