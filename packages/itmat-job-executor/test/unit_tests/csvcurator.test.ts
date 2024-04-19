import fs from 'fs';
import path from 'path';
import { IJobEntryForDataCuration, enumValueType } from '@itmat-broker/itmat-types';
import { processDataRow, processHeader, CSVCurator } from '../../src/curation/CSVCurator';
import { stub } from './_stubHelper';

describe('Unit tests for processHeader function', () => {
    const fieldsList = [
        {
            fieldId: 1,
            fieldName: 'SubjectID',
            possibleValues: [],
            unit: '',
            comments: '',
            dataType: enumValueType.STRING
        },
        {
            fieldId: 2,
            fieldName: 'VisitID',
            possibleValues: [],
            unit: '',
            comments: '',
            dataType: enumValueType.STRING
        },
        {
            fieldId: 31,
            fieldName: 'Sex',
            possibleValues: [{ code: '1', description: 'male' }, { code: '0', description: 'female' }],
            unit: '',
            comments: '',
            dataType: enumValueType.CATEGORICAL
        },
        {
            fieldId: 32,
            fieldName: 'Description',
            possibleValues: [],
            unit: '',
            comments: '',
            dataType: enumValueType.STRING
        },
        {
            fieldId: 33,
            fieldName: 'Weight',
            possibleValues: [],
            unit: 'Kg',
            comments: '',
            dataType: enumValueType.DECIMAL
        }
    ];

    it('processHeader function', () => {
        const exampleheader = ['ID', 'SubjectID', 'VisitID', 'Sex', 'Description', 'Weight'];
        const { parsedHeader, error, subjectIdIndex, visitIdIndex } = processHeader(exampleheader, fieldsList);
        expect(parsedHeader.length).toBe(5);
        expect(parsedHeader).toEqual(fieldsList);
        expect(error).toBeUndefined();
        expect(subjectIdIndex).toBe(1);
        expect(visitIdIndex).toBe(2);
    });

    it('processHeader function without SubjectID or VisitID', () => {
        const exampleheader = ['ID', 'SubjectID', 'Sex', 'Description', 'Weight'];
        const { parsedHeader, error, subjectIdIndex, visitIdIndex } = processHeader(exampleheader, fieldsList);
        expect(parsedHeader.length).toBe(4);
        expect(parsedHeader[0]).toEqual(fieldsList[0]);
        expect(parsedHeader[1]).toEqual(fieldsList[2]);
        expect(parsedHeader[2]).toEqual(fieldsList[3]);
        expect(parsedHeader[3]).toEqual(fieldsList[4]);
        expect(error).toBeDefined();
        if (!error)
            return;
        expect(error.length).toBe(1);
        expect(error[0]).toBe('SubjectID or VisitID not found.');
        expect(subjectIdIndex).toBe(1);
        expect(visitIdIndex).toBe(0);
    });

    it('processHeader function weeds out duplicates', () => {
        const exampleheader = ['ID', 'SubjectID', 'VisitID', 'Sex', 'Description', 'Weight', 'Weight'];
        const { error, parsedHeader } = processHeader(exampleheader, fieldsList);
        expect(parsedHeader.length).toBe(6);
        expect(parsedHeader[0]).toEqual(fieldsList[0]);
        expect(parsedHeader[1]).toEqual(fieldsList[1]);
        expect(parsedHeader[2]).toEqual(fieldsList[2]);
        expect(parsedHeader[3]).toEqual(fieldsList[3]);
        expect(parsedHeader[4]).toEqual(fieldsList[4]);
        expect(parsedHeader[5]).toEqual({
            dataType: 'dul',
            fieldId: undefined,
            fieldName: 'Weight'
        });
        expect(error).toBeDefined();
        if (!error)
            return;
        expect(error.length).toBe(1);
        expect(error[0]).toBe('Line 1 column 7: Duplicate field.');
    });

    it('processHeader function weeds with unregistered fields', () => {
        const exampleheader = ['ID', 'SubjectID', 'VisitID', 'Sex', 'Description', 'Weight', 'UNKNOWN'];
        const { error, parsedHeader } = processHeader(exampleheader, fieldsList);
        expect(parsedHeader.length).toBe(6);
        expect(parsedHeader[0]).toEqual(fieldsList[0]);
        expect(parsedHeader[1]).toEqual(fieldsList[1]);
        expect(parsedHeader[2]).toEqual(fieldsList[2]);
        expect(parsedHeader[3]).toEqual(fieldsList[3]);
        expect(parsedHeader[4]).toEqual(fieldsList[4]);
        expect(parsedHeader[5]).toEqual({ fieldName: 'UNKNOWN', dataType: 'unk', fieldId: undefined });
        expect(error).toBeDefined();
        if (!error)
            return;
        expect(error[0]).toBe('Line 1 column 7: Unknown field.');
    });
});

describe('Unit tests for processDataRow function', () => {
    const fieldsList = [
        {
            fieldId: 1,
            fieldName: 'SubjectID',
            possibleValues: [],
            unit: '',
            comments: '',
            dataType: enumValueType.STRING
        },
        {
            fieldId: 2,
            fieldName: 'VisitID',
            possibleValues: [],
            unit: '',
            comments: '',
            dataType: enumValueType.STRING
        },
        {
            fieldId: 31,
            fieldName: 'Sex',
            possibleValues: [{ code: '1', description: 'male' }, { code: '0', description: 'female' }],
            unit: '',
            comments: '',
            dataType: enumValueType.CATEGORICAL
        },
        {
            fieldId: 32,
            fieldName: 'Description',
            possibleValues: [],
            unit: '',
            comments: '',
            dataType: enumValueType.STRING
        },
        {
            fieldId: 33,
            fieldName: 'Weight',
            possibleValues: [],
            unit: 'Kg',
            comments: '',
            dataType: enumValueType.DECIMAL
        }
    ];

    const job = stub<IJobEntryForDataCuration>({  // subset of the IJobEntry interface
        id: 'mockJobId',
        studyId: 'mockStudyId'
    });
    const { subjectIdIndex, visitIdIndex, parsedHeader } = processHeader(['ID', 'SubjectID', 'VisitID', 'Sex', 'Description', 'Weight'], fieldsList);
    const templateParams = {
        subjectIdIndex: subjectIdIndex,
        visitIdIndex: visitIdIndex,
        lineNum: 22,
        row: [],
        parsedHeader: parsedHeader,
        job
    };

    it('processDataRow function correctly parse data row', () => {
        const { error, dataEntry } = processDataRow(stub<any>({ ...templateParams, row: ['0', 'I7N3G6G', '1', '1', 'description', 60.2] }));
        expect(error).toBeUndefined();
        expect(dataEntry).toEqual({
            m_subjectId: 'I7N3G6G',
            m_visitId: '1',
            m_studyId: 'mockStudyId',
            m_versionId: null,
            31: '1',
            32: 'description',
            33: 60.2,
            deleted: null
        });
    });

    it('processDataRow function weeds out datatype mismatch', () => {
        const { error, dataEntry } = processDataRow(stub<any>({ ...templateParams, row: ['0', 'I7N3G6G', '1', 'a', 'description', 'b'] }));
        expect(error).toBeDefined();
        if (!error)
            return;
        expect(error).toHaveLength(2);
        expect(error[0]).toBe('Line 22 column 4: Cannot parse \'a\' as categorical, value is illegal.');
        expect(error[1]).toBe('Line 22 column 6: Cannot parse \'b\' as decimal.');
        expect(dataEntry).toEqual({
            m_subjectId: 'I7N3G6G',
            m_visitId: '1',
            m_studyId: 'mockStudyId',
            m_versionId: null,
            32: 'description',
            deleted: null
        });
    });

    it('processDataRow function deals with missing value by skipping', () => {
        const { error, dataEntry } = processDataRow(stub<any>({ ...templateParams, row: ['0', 'I7N3G6G', '1', '1', 'description', ''] }));
        expect(error).toBeUndefined();
        expect(dataEntry).toEqual({
            m_subjectId: 'I7N3G6G',
            m_visitId: '1',
            m_studyId: 'mockStudyId',
            m_versionId: null,
            31: '1',
            32: 'description',
            deleted: null
        });
    });

    it('processDataRow function deals with missing subject id correctly', () => {
        const { error, dataEntry } = processDataRow(stub<any>({ ...templateParams, row: ['0', '', '1', '1', 'description', 60.2] }));
        expect(error).toBeDefined();
        if (!error)
            return;
        expect(error).toHaveLength(1);
        expect(error[0]).toBe('No subject id provided.');
        expect(dataEntry).toEqual({
            m_visitId: '1',
            m_studyId: 'mockStudyId',
            m_versionId: null,
            31: '1',
            32: 'description',
            33: 60.2,
            deleted: null
        });
    });

    it('processDataRow function deals with missing visit id correctly', () => {
        const { error, dataEntry } = processDataRow(stub<any>({ ...templateParams, row: ['0', 'I7N3G6G', '', '1', 'description', 60.2] }));
        expect(error).toBeDefined();
        if (!error)
            return;
        expect(error).toHaveLength(1);
        expect(error[0]).toBe('No visit id provided.');
        expect(dataEntry).toEqual({
            m_subjectId: 'I7N3G6G',
            m_studyId: 'mockStudyId',
            m_versionId: null,
            31: '1',
            32: 'description',
            33: 60.2,
            deleted: null
        });
    });
});

describe('CSVCuratorClass', () => {
    const fieldsList = [
        {
            fieldId: 1,
            fieldName: 'SubjectID',
            possibleValues: [],
            unit: '',
            comments: '',
            dataType: enumValueType.STRING
        },
        {
            fieldId: 2,
            fieldName: 'VisitID',
            possibleValues: [],
            unit: '',
            comments: '',
            dataType: enumValueType.STRING
        },
        {
            fieldId: 31,
            fieldName: 'Sex',
            possibleValues: [{ code: '1', description: 'male' }, { code: '0', description: 'female' }],
            unit: '',
            comments: '',
            dataType: enumValueType.CATEGORICAL
        },
        {
            fieldId: 32,
            fieldName: 'Description',
            possibleValues: [],
            unit: '',
            comments: '',
            dataType: enumValueType.STRING
        },
        {
            fieldId: 33,
            fieldName: 'Weight',
            possibleValues: [],
            unit: 'Kg',
            comments: '',
            dataType: enumValueType.DECIMAL
        }
    ];

    // should stop uploading when error occurs
    function BulkInsert(this: any) {
        this._insertArray = [];
        this._executeCalled = []; // array of length of _insertArray when execute() is called
        this.insert = (object: any) => { this._insertArray.push(object); };
        this._foundobj = null;
        this.find = (object: { [x: string]: any; }) => {
            let tag;
            for (const each of this._insertArray) {
                tag = true;
                for (const field of Object.keys(object)) {
                    if (JSON.stringify(object[field]) !== JSON.stringify(each[field])) {
                        tag = false;
                        break;
                    }
                }
                if (tag === true) {
                    this._foundobj = each;
                    break;
                }
            }
            return this;
        };
        this.upsert = () => { return this; };
        this.execute = async () => new Promise<void>((resolve) => {
            setTimeout(() => {
                this._executeCalled.push(this._insertArray.length);
                resolve();
            }, 10);
        });
        this.updateOne = (object: { [x: string]: { [x: string]: any; }; }) => {
            if (this._foundobj === null) {
                this._insertArray.push(object['$set']);
            }
            for (let i = 0; i < this._insertArray.length; i++) {
                if (JSON.stringify(this._insertArray[i]) === JSON.stringify(this._foundobj)) {
                    for (const field of Object.keys(object['$set'])) {
                        this._insertArray[i][field] = object['$set'][field];
                    }
                }
            }
            this._foundobj = null;
        };
    }

    function MongoStub(this: any) {
        this._bulkinsert = new (BulkInsert as any)();
        this.initializeUnorderedBulkOp = () => this._bulkinsert;
    }

    it('test mongostub update new', async () => {
        const bulkinsert = (new (MongoStub as any)()).initializeUnorderedBulkOp();
        bulkinsert.insert({ a: 1 });
        bulkinsert.insert({ b: 2 });
        return bulkinsert.execute().then(() => {
            bulkinsert.find({ c: 3 }).upsert().updateOne({ $set: { c: 4 } });
            return bulkinsert.execute();
        }).then(() => {
            expect(bulkinsert._insertArray).toEqual([{ a: 1 }, { b: 2 }, { c: 4 }]);
            expect(bulkinsert._executeCalled).toEqual([2, 3]);
        });
    }, 10000);

    it('test mongostub update existing', async () => {
        const bulkinsert = (new (MongoStub as any)()).initializeUnorderedBulkOp();
        bulkinsert.insert({ a: 1 });
        bulkinsert.insert({ b: 2 });
        return bulkinsert.execute().then(() => {
            bulkinsert.find({ b: 2 }).upsert().updateOne({ $set: { d: 4 } });
            return bulkinsert.execute();
        }).then(() => {
            expect(bulkinsert._insertArray).toEqual([{ a: 1 }, { b: 2, d: 4 }]);
            expect(bulkinsert._executeCalled).toEqual([2, 2]);
        });
    }, 10000);

    it('csvcurator uploads csv file okay', async () => {
        const readStream = fs.createReadStream(path.join(__dirname, '../testFiles/CSVCurator.tsv'));
        const mongoStub = new (MongoStub as any)();
        const jobEntry = stub<IJobEntryForDataCuration>({  // subset of the IJobEntry interface
            id: 'mockJobId',
            studyId: 'mockStudyId'
        });
        const csvcurator = new CSVCurator(
            mongoStub,
            readStream,
            undefined,
            jobEntry,
            fieldsList
        );
        const errors = await csvcurator.processIncomingStreamAndUploadToMongo();
        expect(errors).toEqual([]);
        expect(mongoStub._bulkinsert._insertArray).toHaveLength(2226);
        expect(mongoStub._bulkinsert._executeCalled).toEqual([1000, 2000, 2226]);
        expect(mongoStub._bulkinsert._insertArray[0]).toEqual({
            m_subjectId: 'I7N3G6G',
            m_visitId: '1',
            m_studyId: 'mockStudyId',
            m_versionId: null,
            31: '0',
            32: 'no description',
            33: 60.2,
            deleted: null
        });

    });

    it('csvcurator catches non-existing headers', async () => {
        const readStream = fs.createReadStream(path.join(__dirname, '../testFiles/CSVCurator_error1.tsv'));
        const mongoStub = new (MongoStub as any)();
        const jobEntry = stub<IJobEntryForDataCuration>({  // subset of the IJobEntry interface
            id: 'mockJobId',
            studyId: 'mockStudyId'
        });
        const csvcurator = new CSVCurator(
            mongoStub,
            readStream,
            undefined,
            jobEntry,
            fieldsList
        );
        const errors = await csvcurator.processIncomingStreamAndUploadToMongo();
        expect(errors.length).toBe(1);
        expect(errors[0]).toBe('Line 1 column 7: Unknown field.');
        expect(mongoStub._bulkinsert._insertArray).toHaveLength(0);
        expect(mongoStub._bulkinsert._executeCalled).toEqual([]);

    });

    it('csvcurator catches duplicate header', async () => {
        const readStream = fs.createReadStream(path.join(__dirname, '../testFiles/CSVCurator_error2.tsv'));
        const mongoStub = new (MongoStub as any)();
        const jobEntry = stub<IJobEntryForDataCuration>({  // subset of the IJobEntry interface
            id: 'mockJobId',
            studyId: 'mockStudyId'
        });
        const csvcurator = new CSVCurator(
            mongoStub,
            readStream,
            undefined,
            jobEntry,
            fieldsList
        );
        const errors = await csvcurator.processIncomingStreamAndUploadToMongo();
        expect(errors[0]).toBe('Line 1 column 6: Duplicate field.');
        expect(mongoStub._bulkinsert._insertArray).toHaveLength(0);
        expect(mongoStub._bulkinsert._executeCalled).toEqual([]);

    });

    it('csvcurator catches uneven field before watermark', async () => {
        const readStream = fs.createReadStream(path.join(__dirname, '../testFiles/CSVCurator_error3.tsv'));
        const mongoStub = new (MongoStub as any)();
        const jobEntry = stub<IJobEntryForDataCuration>({  // subset of the IJobEntry interface
            id: 'mockJobId',
            studyId: 'mockStudyId'
        });
        const csvcurator = new CSVCurator(
            mongoStub,
            readStream,
            undefined,
            jobEntry,
            fieldsList
        );

        const errors = await csvcurator.processIncomingStreamAndUploadToMongo();
        expect(errors).toEqual([
            'Line 18: Uneven field Number; expected 6 fields but got 5',
            'Line 28: Uneven field Number; expected 6 fields but got 5'
        ]);
        expect(mongoStub._bulkinsert._insertArray).toHaveLength(16);
        expect(mongoStub._bulkinsert._executeCalled).toEqual([]);
        expect(mongoStub._bulkinsert._insertArray[0]).toEqual({
            m_subjectId: 'I7N3G6G',
            m_visitId: '1',
            m_studyId: 'mockStudyId',
            m_versionId: null,
            31: '0',
            32: 'no description',
            33: 60.2,
            deleted: null
        });

    });

    it('csvcurator catches uneven field after watermark', async () => {
        const readStream = fs.createReadStream(path.join(__dirname, '../testFiles/CSVCurator_error4.tsv'));
        const mongoStub = new (MongoStub as any)();
        const jobEntry = stub<IJobEntryForDataCuration>({  // subset of the IJobEntry interface
            id: 'mockJobId',
            studyId: 'mockStudyId'
        });
        const csvcurator = new CSVCurator(
            mongoStub,
            readStream,
            undefined,
            jobEntry,
            fieldsList
        );

        const errors = await csvcurator.processIncomingStreamAndUploadToMongo();
        expect(errors).toEqual([
            'Line 1530: Uneven field Number; expected 6 fields but got 4',
            'Line 1836: Uneven field Number; expected 6 fields but got 5'
        ]);
        expect(mongoStub._bulkinsert._insertArray).toHaveLength(1528);
        expect(mongoStub._bulkinsert._executeCalled).toEqual([1000]);
        expect(mongoStub._bulkinsert._insertArray[0]).toEqual({
            m_subjectId: 'I7N3G6G',
            m_visitId: '1',
            m_studyId: 'mockStudyId',
            m_versionId: null,
            31: '0',
            32: 'no description',
            33: 60.2,
            deleted: null
        });

    });

    it('csvcurator catches mixed errors', async () => {
        const readStream = fs.createReadStream(path.join(__dirname, '../testFiles/CSVCurator_error5.tsv'));
        const mongoStub = new (MongoStub as any)();
        const jobEntry = stub<IJobEntryForDataCuration>({  // subset of the IJobEntry interface
            id: 'mockJobId',
            studyId: 'mockStudyId'
        });
        const csvcurator = new CSVCurator(
            mongoStub,
            readStream,
            undefined,
            jobEntry,
            fieldsList
        );

        const errors = await csvcurator.processIncomingStreamAndUploadToMongo();
        expect(errors).toEqual([
            'Line 1 column 7: Unknown field.',
            'Line 8 column 4: Cannot parse \'a\' as categorical, value is illegal.',
            'Line 31: Uneven field Number; expected 7 fields but got 6',
            'Line 32: Uneven field Number; expected 7 fields but got 6',
            'Line 1531: Uneven field Number; expected 7 fields but got 3',
            'Line 1532: Uneven field Number; expected 7 fields but got 4'
        ]);
        expect(mongoStub._bulkinsert._insertArray).toHaveLength(0);
        expect(mongoStub._bulkinsert._executeCalled).toEqual([]);
    });
});
