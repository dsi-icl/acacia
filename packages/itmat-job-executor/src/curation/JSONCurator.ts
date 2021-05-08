import { Collection } from 'mongodb';
import { Writable, Readable } from 'stream';
import JSONStream from 'JSONStream';
import { IFieldDescriptionObject, IDataEntry, IJobEntry } from 'itmat-commons';

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
    private _subjectIdIndex: number;
    private _visitIdIndex: number;

    constructor(
        private readonly dataCollection: Collection,
        private readonly incomingWebStream: Readable,
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
                        objectNum++;
                        const { error, parsedHeader, subjectIdIndex, visitIdIndex } = processJSONHeader(chunk, this.fieldsList);
                        if (error) {
                            this._errored = true;
                            this._errors.push(...error);
                        }
                        this._header = parsedHeader;
                        this._subjectIdIndex = subjectIdIndex;
                        this._visitIdIndex = visitIdIndex;
                        isHeader = false;

                    } else {
                        subjectString.push(chunk[0]);
                        const { error, dataEntry } = processEachSubject({
                            subjectIdIndex: this._subjectIdIndex,
                            visitIdIndex: this._visitIdIndex,
                            objectNum: objectNum,
                            subject: chunk,
                            parsedHeader: this._header,
                            job: this.job
                        });
                        if (error) {
                            this._errored = true;
                            this._errors.push(...error);
                        }

                        if (this._errored) {
                            callback();
                            return;
                        }
                        const matchObj = {
                            m_subjectId: dataEntry.m_subjectId,
                            m_visitId: dataEntry.m_visitId,
                            m_versionId: dataEntry.m_versionId,
                            m_studyId: dataEntry.m_studyId
                        };
                        bulkInsert.find(matchObj).upsert().updateOne({$set: dataEntry});
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


export function processJSONHeader(header: string[], fieldsList: any[]): { error?: string[], parsedHeader: any[], subjectIdIndex: number, visitIdIndex: number } {
    /* pure function */
    /* headerObject is ['eid', 1@0.0, 2@0.1:c] */
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
            error.push(`Object 1, Column ${colNum}: Field Name should not be empty.`);
            colNum++;
            parsedHeader.push(null);
        } else {
            if (fields.includes(each)) {
                // if duplicates happens, we only extract data from the first one
                error.push(`Object 1 column ${colNum + 1}: Duplicate field.`);
                parsedHeader.push({fieldName: each, dataType: 'dul', fieldId: undefined});
                colNum++;
                continue;
            }
            fields.push(each);
            if (validatedFieldNames.includes(each)) {
                parsedHeader.push(fieldsList.filter(el => el.fieldName === each)[0]);
            } else {
                error.push(`Object 1 column ${colNum + 1}: Unknown field.`);
                parsedHeader.push({fieldName: each, dataType: 'unk', fieldId: undefined});
            }
        }
        colNum++;
    }

    const filteredParsedHeader = parsedHeader.filter(el => el !== undefined);
    const subjectIdIndex = filteredParsedHeader.findIndex(el => el.fieldName === 'SubjectID') + 1; // ID is the first
    const visitIdIndex = filteredParsedHeader.findIndex(el => el.fieldName === 'VisitID') + 1;
    return ({ parsedHeader: filteredParsedHeader, error: error.length === 0 ? undefined : error , subjectIdIndex, visitIdIndex});
}

export function processEachSubject({ subjectIdIndex, visitIdIndex, objectNum, subject, parsedHeader, job }: { subjectIdIndex: number, visitIdIndex: number, objectNum: number, subject: string[], parsedHeader: any[], job: IJobEntry<never> }): { error?: string[], dataEntry: Partial<IDataEntry> } {
    /* pure function */
    const error: string[] = [];
    let colIndex = 0;
    const dataEntry: any = {
        m_studyId: job.studyId,
        deleted: null
    };
    if (subject.length !== (parsedHeader.filter(el => el !== undefined).length + 1)) {
        error.push(`Object ${objectNum}: Uneven field Number; expected ${parsedHeader.length + 1} fields but got ${subject.length}`);
        return ({ error, dataEntry });
    }
    for (const each of subject) {
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
            switch (dataType) {
                case 'cat': {// categorical
                    const code = parseInt(each, 10).toString();
                    if (!possibleValues.map(el => el.code).includes(code)) {
                        error.push(`Object ${objectNum} column ${colIndex + 1}: Cannot parse '${each}' as categorical, value is illegal.`);
                        colIndex++;
                        continue;
                    }
                    value = code;
                    break;
                }
                case 'dec': {// decimal
                    if (!/^\d+(.\d+)?$/.test(each)) {
                        error.push(`Object ${objectNum} column ${colIndex + 1}: Cannot parse '${each}' as decimal.`);
                        colIndex++;
                        continue;
                    }
                    value = parseFloat(each);
                    break;
                }
                case 'int': {// integer
                    if (!/^\d+$/.test(each)) {
                        error.push(`Object ${objectNum} column ${colIndex + 1}: Cannot parse '${each}' as integer.`);
                        colIndex++;
                        continue;
                    }
                    value = parseInt(each, 10);
                    break;
                }
                case 'boo': {// boolean
                    if (each.toLowerCase() === 'true' || each.toLowerCase() === 'false') {
                        value = each.toLowerCase() === 'true';
                    } else {
                        error.push(`Object ${objectNum} column ${colIndex + 1}: value for boolean type must be 'true' or 'false'.`);
                        colIndex++;
                        continue;
                    }
                    break;
                }
                case 'str': {
                    value = each.toString();
                    break;
                }
                case 'dat': {
                    const part = each.split('/');
                    const tmp = part[1];
                    part[1] = part[0];
                    part[0] = tmp;
                    value = new Date(part[0].concat('/').concat(part[1]).concat('/').concat(part[2])).toISOString();
                    break;
                }
                case 'jso': {// save as string
                    value = JSON.stringify(each);
                    break;
                }
                case 'fil': {
                    value = each.toString();
                    break;
                }
                case 'unk': {
                    value = each.toString();
                    break;
                }
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

    if (dataEntry.m_subjectId === undefined) {
        error.push('No subject id provided.');
    }
    if (dataEntry.m_visitId === undefined) {
        error.push('No visit id provided.');
    }
    return ({ error: error.length === 0 ? undefined : error, dataEntry });
}
