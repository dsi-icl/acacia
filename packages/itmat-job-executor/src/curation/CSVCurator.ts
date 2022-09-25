import * as csvparse from 'csv-parse';
import { Collection } from 'mongodb';
import { Writable, Readable } from 'stream';
import { IFieldDescriptionObject, IDataEntry, IJobEntry } from '@itmat-broker/itmat-types';

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
        private readonly dataCollection: Collection<IDataEntry>,
        private readonly incomingWebStream: Readable,
        private readonly parseOptions: csvparse.Options = { delimiter: ',', quote: '"', relax_column_count: true, skip_records_with_error: true },
        private readonly job: IJobEntry<never>,
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
            let lineNum = 0;
            let isHeader = true;
            const subjectString: string[] = [];
            let bulkInsert = this.dataCollection.initializeUnorderedBulkOp();
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
                        subjectString.push(line[this._subjectIdIndex]);
                        const { error, dataEntry } = processDataRow({
                            subjectIdIndex: this._subjectIdIndex,
                            visitIdIndex: this._visitIdIndex,
                            lineNum: currentLineNum,
                            row: line,
                            parsedHeader: this._header,
                            job: this.job
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
                        };
                        bulkInsert.find(matchObj).upsert().updateOne({ $set: dataEntry });

                        this._numOfSubj++;
                        if (this._numOfSubj > 999) {
                            this._numOfSubj = 0;
                            await bulkInsert.execute((err) => {
                                if (err) {
                                    //TODO Handle error recording
                                    console.error(err);
                                }
                            });
                            bulkInsert = this.dataCollection.initializeUnorderedBulkOp();
                        }
                        next();
                    }
                }
            });

            uploadWriteStream.on('finish', async () => {
                if (!this._errored) {
                    await bulkInsert.execute((err) => {
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


export function processHeader(header: string[], fieldsList: any[]): { error?: string[], parsedHeader: any[], subjectIdIndex: number, visitIdIndex: number } {
    /* pure function */
    /* headerline is ['eid', 1@0.0, 2@0.1:c] */
    /* returns a parsed object array and error (undefined if no error) */

    // const fieldstrings: string[] = [];
    const error: string[] = [];
    const parsedHeader: any[] = Array(header.length);
    let colNum = 0;
    const fields: string[] = [];
    const validatedFieldNames = fieldsList.map(el => el.fieldName);
    if (!header.includes('SubjectID') || !header.includes('VisitID')) {
        error.push('SubjectID or VisitID not found.');
    }
    for (const each of header) {
        if (colNum === 0) {
            colNum++;
            continue;
        }
        if (each === null || each === undefined || each === '') {
            error.push(`Line 1, Column ${colNum}: Field Name should not be empty.`);
            colNum++;
            parsedHeader.push(null);
        } else {
            if (fields.includes(each)) {
                // if duplicates happens, we only extract data from the first one
                error.push(`Line 1 column ${colNum + 1}: Duplicate field.`);
                parsedHeader.push({ fieldName: each, dataType: 'dul', fieldId: undefined });
                colNum++;
                continue;
            }
            fields.push(each);
            if (validatedFieldNames.includes(each)) {
                parsedHeader.push(fieldsList.filter(el => el.fieldName === each)[0]);
            } else {
                error.push(`Line 1 column ${colNum + 1}: Unknown field.`);
                parsedHeader.push({ fieldName: each, dataType: 'unk', fieldId: undefined });
            }
        }
        colNum++;
    }

    const filteredParsedHeader = parsedHeader.filter(el => el !== undefined);
    const subjectIdIndex = filteredParsedHeader.findIndex(el => el.fieldName === 'SubjectID') + 1; // ID is the first
    const visitIdIndex = filteredParsedHeader.findIndex(el => el.fieldName === 'VisitID') + 1;
    return ({ parsedHeader: filteredParsedHeader, error: error.length === 0 ? undefined : error, subjectIdIndex, visitIdIndex });
}

export function processDataRow({ subjectIdIndex, visitIdIndex, lineNum, row, parsedHeader, job }: { subjectIdIndex: number, visitIdIndex: number, lineNum: number, row: string[], parsedHeader: any[], job: IJobEntry<never> }): { error?: string[], dataEntry: Partial<IDataEntry> } {
    /* pure function */
    const error: string[] = [];
    let colIndex = 0;
    const dataEntry: any = {
        m_studyId: job.studyId,
        m_versionId: null,
        deleted: null
    };
    if (row.length !== (parsedHeader.filter(el => el !== undefined).length + 1)) {
        error.push(`Line ${lineNum}: Uneven field Number; expected ${parsedHeader.length + 1} fields but got ${row.length}`);
        return ({ error, dataEntry });
    }
    for (const each of row) {
        if (colIndex === 0) {
            // first column is ID, no actual meaning
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
            dataEntry.m_subjectId = each.replace('-', '');
            colIndex++;
            continue;
        }

        if (colIndex === visitIdIndex) {
            dataEntry.m_visitId = each;
            colIndex++;
            continue;
        }
        const { fieldId, dataType, possibleValues } = parsedHeader[colIndex - 1];
        if (fieldId === undefined) {
            colIndex++;
            continue;
        }
        /* adding value to dataEntry */
        let value: any;
        try {
            if (each.toString() === '99999') {
                value = '99999';
            } else {
                switch (dataType) {
                    case 'cat': {// categorical
                        const code = parseInt(each, 10).toString();
                        if (!possibleValues.map((el: any) => el.code).includes(code)) {
                            error.push(`Line ${lineNum} column ${colIndex + 1}: Cannot parse '${each}' as categorical, value is illegal.`);
                            colIndex++;
                            continue;
                        }
                        value = code;
                        break;
                    }
                    case 'dec': {// decimal
                        if (!/^\d+(.\d+)?$/.test(each)) {
                            error.push(`Line ${lineNum} column ${colIndex + 1}: Cannot parse '${each}' as decimal.`);
                            colIndex++;
                            continue;
                        }
                        value = parseFloat(each);
                        break;
                    }
                    case 'int': {// integer
                        if (!/^-?\d+$/.test(each)) {
                            error.push(`Line ${lineNum} column ${colIndex + 1}: Cannot parse '${each}' as integer.`);
                            colIndex++;
                            continue;
                        }
                        value = parseInt(each, 10);
                        break;
                    }
                    case 'bool': {// boolean
                        if (each.toLowerCase() === 'true' || each.toLowerCase() === 'false') {
                            value = each.toLowerCase() === 'true';
                        } else {
                            error.push(`Line ${lineNum} column ${colIndex + 1}: value for boolean type must be 'true' or 'false'.`);
                            colIndex++;
                            continue;
                        }
                        break;
                    }
                    case 'str': {
                        value = each.toString();
                        break;
                    }
                    case 'date': {
                        const matcher = /^(-?(?:[1-9][0-9]*)?[0-9]{4})-(1[0-2]|0[1-9])-(3[01]|0[1-9]|[12][0-9])T(2[0-3]|[01][0-9]):([0-5][0-9]):([0-5][0-9])(.[0-9]+)?(Z)?/;
                        if (!each.match(matcher)) {
                            error.push(`Line ${lineNum} column ${colIndex + 1}: value for date type must be in ISO format.`);
                            colIndex++;
                            continue;
                        }
                        value = each.toString();
                        break;
                    }
                    case 'json': {
                        value = each;
                        break;
                    }
                    case 'file': {
                        value = each.toString();
                        break;
                    }
                    default: {
                        error.push(`Line ${lineNum} column ${colIndex + 1}: Invalid data Type.`);
                        break;
                    }
                }
            }
        } catch (e: any) {
            error.push(e.toString());
            continue;
        }

        if (dataEntry[fieldId] === undefined) {
            dataEntry[fieldId] = null;
        }

        dataEntry[fieldId] = value;
        colIndex++;
    }

    if (dataEntry.m_subjectId === undefined) {
        error.push('No subject id provided.');
    }
    if (dataEntry.m_visitId === undefined) {
        error.push('No visit id provided.');
    }
    return ({ error: error.length === 0 ? undefined : error, dataEntry });
}
