import { Collection } from 'mongodb';
import { Writable, Readable } from 'stream';
import JSONStream from 'JSONStream';
import { IFieldDescriptionObject, IDataEntry, IJobEntry } from 'itmat-commons';
import { fieldValidator, fieldParser } from '../utils/jobUtils';

/* update should be audit trailed */
/* eid is not checked whether it is unique in the file: this is assumed to be enforced by database */
export class JSONCurator {
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
            let isHeader = true;
            let objectNum = 0;
            const subjectString: string[] = [];
            let bulkInsert = this.dataCollection.initializeUnorderedBulkOp();
            const jsonstream = JSONStream.parse([{}]);
            const uploadWriteStream: NodeJS.WritableStream = new Writable({
                objectMode: true,
                write: async (chunk, _, callback) => {
                    objectNum++;
                    if (isHeader) {
                        const { error, parsedHeader } = processJSONHeader(chunk);
                        if (error) {
                            this._errored = true;
                            this._errors.push(...error);
                        }
                        this._header = parsedHeader;
                        isHeader = false;

                    } else {
                        subjectString.push(chunk[0]);
                        const { error, dataEntry } = processEachSubject({
                            objectNum: objectNum,
                            subject: chunk,
                            parsedHeader: this._header,
                            job: this.job,
                            versionId: this.versionId
                        });
                        if (error) {
                            this._errored = true;
                            this._errors.push(...error);
                        }

                        if (this._errored) {
                            callback();
                            return;
                        }
                        bulkInsert.insert(dataEntry);
                        this._numOfSubj++;

                    }
                    if (this._numOfSubj > 999) {
                        this._numOfSubj = 0;
                        await bulkInsert.execute((err, res) => {
                            if (err) {
                                console.log(res.getWriteErrors()[1]);
                                return;
                            }
                        });
                        bulkInsert = this.dataCollection.initializeUnorderedBulkOp();
                    }
                    callback();
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
            this.incomingWebStream.pipe(jsonstream);
            jsonstream.pipe(uploadWriteStream);
        });
    }
}

export function processJSONHeader(header: string[]): { error?: string[], parsedHeader: Array<IFieldDescriptionObject | null> } {
    const fieldstrings: string[] = [];
    const error: string[] = [];
    const parsedHeader: Array<IFieldDescriptionObject | null> = Array(header.length);
    let colNum = 0;
    for (const each of header) {
        if (colNum === 0) {
            parsedHeader[0] = null;
        } else {
            if (!fieldValidator(each)) {
                error.push(`Object 1: '${each}' is not a valid header field descriptor.`);
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
        error.push('Object 1: There is duplicate (field, timepoint, measurement) combination.');
    }
    return ({ parsedHeader, error: error.length === 0 ? undefined : error });

}

export function processEachSubject({ subject, parsedHeader, job, versionId, objectNum }: { objectNum: number, versionId: string, subject: string[], parsedHeader: Array<IFieldDescriptionObject | null>, job: IJobEntry<{ dataVersion: string, versionTag?: string }> }): { error?: string[], dataEntry: Partial<IDataEntry> } {
    const error: string[] = [];
    let colIndex = 0;
    const dataEntry: any = {
        m_jobId: job.id,
        m_study: job.studyId,
        m_versionId: versionId
    };

    if (subject.length !== parsedHeader.length) {
        error.push(`Object ${subject[0]}: Uneven field Number; expected ${parsedHeader.length} fields but got ${subject.length}`);
        return ({ error, dataEntry });
    }
    for (const each of subject) {
        if (colIndex === 0) {
            /* extracting subject id */
            if (each === '') {
                error.push(`Object ${objectNum}: No subject id provided.`);
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
        let value: unknown;
        try {
            switch (datatype) {
                case 'c': // categorical
                    value = each;
                    break;
                case 'd': // decimal
                    if (!/^\d+(.\d+)?$/.test(each)) {
                        error.push(`The ${objectNum} object (subjectId: ${dataEntry.m_eid}) column ${colIndex + 1}: Cannot parse '${each}' as decimal.`);
                        colIndex++;
                        continue;
                    }
                    value = parseFloat(each);
                    break;
                case 'i': // integer
                    if (!/^\d+$/.test(each)) {
                        error.push(`The ${objectNum} object (subjectId: ${dataEntry.m_eid}) column ${colIndex + 1}: Cannot parse '${each}' as integer.`);
                        colIndex++;
                        continue;
                    }
                    value = parseInt(each, 10);
                    break;
                case 'b': // boolean
                    if (each.toLowerCase() === 'true' || each.toLowerCase() === 'false') {
                        value = each.toLowerCase() === 'true';
                    } else {
                        error.push(`The ${objectNum} object (subjectId: ${dataEntry.m_eid}) column ${colIndex + 1}: value for boolean type must be 'true' or 'false'.`);
                        colIndex++;
                        continue;
                    }
                    break;
                case 't':
                    value = each;
                    break;
                default:
                    error.push(`The ${objectNum} object (subjectId: ${dataEntry.m_eid}): Invalid data type '${datatype}'`);
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

