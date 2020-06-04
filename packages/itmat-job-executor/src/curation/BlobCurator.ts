import csvparse from 'csv-parse';
import { Collection } from 'mongodb';
import { Writable } from 'stream';
import { Models } from 'itmat-commons';

/* update should be audit trailed */
/* eid is not checked whether it is unique in the file: this is assumed to be enforced by database */
export class BlobCurator extends Curator {
    private _data: IBlobEntry[];
    private _errored: boolean; // tslint:disable-line
    private _errors: string[]; // tslint:disable-line

    constructor(
        private readonly dataCollection: Collection,
        private readonly fileCollection: Collection,
        private readonly incomingWebStream: NodeJS.ReadableStream,
        private readonly parseOptions: csvparse.Options = { delimiter: '\t', quote: '"', relax_column_count: true, skip_lines_with_error: true },
        private readonly job: Models.JobModels.IJobEntryForBlobCuration,
        private readonly versionId: string
    ) {
        super();
        this._data = [];
        this._errored = false;
        this._errors = [];
    }

    /* return list of errors. [] if no error */
    public processIncomingStreamAndUploadToMongo(): Promise<string[]> {
        return new Promise((resolve) => {
            console.log(`uploading for job ${this.job.id}`);
            let lineNum = 0;
            let isHeader: boolean = true;
            const subjFieldPair: string[] = []; // (subj, field) need to be unique
            const data: IBlobEntry[] = [];
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
                        isHeader = false;
                        next();
                    } else {
                        const currentLineNum = ++lineNum;
                        // subjFieldPair.push(`${}`);
                        const { error, dataEntry } = processDataRow({
                            lineNum: currentLineNum,
                            row: line,
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

                        const { subjectId, fieldId, timepoint, measurement } = dataEntry;
                        subjFieldPair.push(`${subjectId}_${fieldId}_${timepoint}_${measurement}`);
                        data.push(dataEntry);

                        // bulkInsert.insert(dataEntry);
                        // if (this._numOfSubj > 999) {
                        //     this._numOfSubj = 0;
                        //     await bulkInsert.execute((err: Error) => {
                        //         if (err) { console.log((err as any).writeErrors[1].err); return; }
                        //     });
                        //     bulkInsert = this.dataCollection.initializeUnorderedBulkOp();
                        // }
                        next();
                    }
                }
            });

            uploadWriteStream.on('finish', async () => {
                /* check for subject Id duplicate */
                const set = new Set(subjFieldPair);
                if (set.size !== subjFieldPair.length) {
                    this._errors.push('Data Error: There is duplicate (subjectid-field) pair.');
                    this._errored = true;
                }

                /* check all non-zipped files exists */
                if (!this._errored) {
                    const mongoQuery = data
                                        .map(e => 
                                            e.fromZipped ?
                                                ({
                                                    deleted: null,
                                                    fileName: e.fileId,
                                                    fromZippedFileId: e.zipFileId
                                                })
                                                :
                                                ({
                                                    deleted: null,
                                                    id: e.fileId
                                                })
                                        );
                    const filesInMongo = await this.fileCollection.find(mongoQuery, { projection: { id: 1, fileName: 1, fromZippedFileId: 1 } }).toArray();

                    const missingFiles: string[] = [];
                    if (filesInMongo.length !== mongoQuery.length) {
                        const allFilesSet = new Set(data.map(e => e.fileId));
                        const mongoFilesIdSet = new Set(filesInMongo.map(e => e.id));
                        const mongoFilesNameSet = new Set(filesInMongo.map(e => `${fromZippedFileId}`));
                        // allFilesSet.forEach(id => {
                        //     if (!mongoFilesSet.has(id)) {
                        //         missingFiles.push(id);
                        //     }
                        // });
                        this._errors.push(`Data Error: One or more files do not exist: ${JSON.stringify(missingFiles)}.`);
                        this._errored = true;
                    }

                    /* check all zipped files exists */
                    const allZippedFiles = data
                                            .filter(e => e.fromZipped)
                                            .map(e => ({
                                                deleted: null,
                                                fileName: 
                                                id: e.fileId
                                            }));
                    const countResult = await this.fileCollection.countDocuments(allNonZippedFiles);
                    if (countResult !== allNonZippedFiles.length) {
                        this._errors.push('Data Error: There is duplicate (subjectid-field) pair.');
                        this._errored = true;
                    }
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

export interface IBlobEntry {
    subjectId: string;
    fieldId: number;
    timepoint: number;
    measurement: number;
    fromZipped: boolean;
    zipFileId: string?;
    fileId: string; // file.id if not zipped, file.name if zipped
}

export function processDataRow({ lineNum, row, job, versionId }: { versionId: string, lineNum: number, row: string[], job: IJobEntry<{ dataVersion: string, versionTag?: string }>}): { error?: string[], dataEntry: IBlobEntry } { // tslint:disable-line
    // subjectId | field    | fileuri
    // _________ | 32@4.2  | {{zipid}}/filename  OR  fileId
    const fieldString = row[1];

    const error: string[] = [];
    if (!/^\d+@\d+.\d+$/.test(fieldString)) {
        error.push(`Line ${lineNum}: '${fieldString}' is not a valid field descriptor.`);
    } else {
        const fieldId = parseInt(fieldString.substring(0, fieldString.indexOf('@')), 10);
        const timepoint = parseInt(fieldString.substring(fieldString.indexOf('@') + 1, fieldString.indexOf('.')), 10);
        const measurement = parseInt(fieldString.substring(fieldString.indexOf('.') + 1, fieldString.length), 10);
        return ({
            error: undefined,
            dataEntry: {
                subjectId: row[0],
                fieldId,
                timepoint,
                measurement,
                fromZipped: row[2].indexOf('zip::') !== -1,
                fileId: row[2]
            }
        });
    }
}

export function turnBlobEntryToMongoAction(dataEntry: IBlobEntry) {
    const { subjectId, fieldId, timepoint, measurement, zipped, } = dataEntry;
    return 
}