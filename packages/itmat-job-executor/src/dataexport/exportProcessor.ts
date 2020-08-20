import { IFieldEntry, Logger } from 'itmat-commons';
import { Transform } from 'json2csv';
import mongodb from 'mongodb';
import { Readable } from 'stream';
import { db } from '../database/database';

export class ExportProcessor {
    /* document from [ mongo cursor -> flatten document -> input stream -> json2csv -> output stream ] -> swift */
    private fieldInfo?: IFieldEntry[];
    private fieldCSVHeaderList?: string[]; // [32-0-0, 32-1-0]
    private inputStream?: Readable;
    private outputParseStream?: Readable;
    constructor(private readonly dataCursor: mongodb.Cursor, private readonly studyId: string, private readonly wantedFields?: string[], private readonly __unused__projectId?: string, private readonly patientIdMap?: { [originalId: string]: string }) { }

    public async fetchFieldInfo(): Promise<void> {
        const queryobj = this.wantedFields === undefined ? { studyId: this.studyId } : { studyId: this.studyId, fieldId: { $in: this.wantedFields } };
        const cursor = db.collections!.field_dictionary_collection.find<IFieldEntry>(queryobj, { projection: { _id: 0 } });
        this.fieldInfo = await cursor.toArray();
        const tmp: string[] = [];
        this.fieldInfo!.forEach((el: IFieldEntry) => {
            for (let i = el.startingTimePoint, maxTimePoint = el.startingTimePoint + el.numOfTimePoints; i < maxTimePoint; i++) {
                for (let j = el.startingMeasurement, maxMeasurement = el.startingMeasurement + el.numOfMeasurements; j < maxMeasurement; j++) {
                    tmp.push(`${el.fieldId}-${i}.${j}`);
                }
            }
        });
        this.fieldCSVHeaderList = tmp;
    }

    public getOutputParseStream(): Readable {
        if (!this.fieldInfo || !this.fieldCSVHeaderList) { throw new Error('Cannot set output stream before fetching field info.'); }
        this.inputStream = new Readable({ objectMode: true });
        const opts = { fields: ['eid', 'study', ...this.fieldCSVHeaderList!] };
        const transformOpts = { objectMode: true };
        const json2csv = new Transform(opts, transformOpts);
        this.outputParseStream = this.inputStream.pipe(json2csv);
        return this.outputParseStream;
    }

    public async startStreamParsing(): Promise<void> {
        if (!this.fieldInfo) { throw new Error('Cannot create export file before fetching field info and setting output stream.'); }
        let nextDocument: Record<string, string | number> | null;
        while (await this.dataCursor.hasNext()) {
            nextDocument = await this.dataCursor.next();
            if (nextDocument) {
                const flattenedData = this.formatDataIntoJSON(nextDocument);
                if (this.patientIdMap) {
                    this.replacePatientId(flattenedData);
                }
                this.writeOneLineToCSV(flattenedData);
            } else {
                Logger.error('Cursor returned null unexpectedly');
            }
        }
        this.writeOneLineToCSV(null);
    }

    private formatDataIntoJSON(onePatientData: Record<string, string | number>): Record<string, string | number> {
        const metadata = {
            eid: onePatientData.m_eid,
            study: onePatientData.m_study
        };
        delete onePatientData.m_eid;
        delete onePatientData.m_study;
        delete onePatientData.m_in_qc;
        delete onePatientData.m_jobId;
        const flattenData: { [field: string]: string | number } = {};
        Object.keys(onePatientData).forEach((fieldkey) => {
            Object.keys(onePatientData[fieldkey]).forEach((instancekey) => {
                Object.keys(onePatientData[fieldkey][instancekey]).forEach((arraykey) => {
                    flattenData[`${fieldkey}-${instancekey}.${arraykey}`] = onePatientData[fieldkey][instancekey][arraykey];
                });
            });
        });
        return ({ ...flattenData, ...metadata });
    }

    private replacePatientId(flattenData: Record<string, string | number>): Record<string, unknown> {
        let newId;
        try {
            newId = this.patientIdMap![flattenData.m_eid];
        } catch (e) {
            Logger.log(e);
            newId = '000error';
        }
        flattenData.eid = newId;
        return flattenData;
    }

    private writeOneLineToCSV(flattenedData: Record<string, unknown> | null): void {
        this.inputStream!.push(flattenedData);
    }


}
