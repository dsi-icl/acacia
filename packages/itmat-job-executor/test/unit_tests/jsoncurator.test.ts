import { processJSONHeader, processEachSubject, JSONCurator } from '../../src/curation/JSONCurator';
import fs from 'fs';
import { stub } from './_stubHelper';
import { IJobEntryForDataCuration } from 'itmat-commons';

describe('Unit tests for processJSONHeader function', () => {
    it('processJSONHeader function weeds out syntax error', () => {
        const exampleheader = ['Eid', '1-3.3', '1-4.3'];
        const { error, parsedHeader } = processJSONHeader(exampleheader);
        expect(parsedHeader.length).toBe(3);
        // expect(parsedHeader[0]).toBeNull();
        expect(parsedHeader[0]).toBeNull();
        expect(parsedHeader[1]).toBeNull();
        expect(error).toBeDefined();
        expect(error.length).toBe(2);
        expect(error[0]).toBe('Object 1: \'1-3.3\' is not a valid header field descriptor.');
        expect(error[1]).toBe('Object 1: \'1-4.3\' is not a valid header field descriptor.');
    });

    it('processJSONHeader function weeds out duplicates', () => {
        const exampleheader = ['Eid', '1@3.3', '1@3.3', '1@2.1', '2@3.2'];
        const { error, parsedHeader } = processJSONHeader(exampleheader);
        expect(parsedHeader.length).toBe(5);
        expect(parsedHeader[0]).toBeNull();
        expect(parsedHeader[1]).toEqual({ fieldId: 1, timepoint: 3, measurement: 3, datatype: 'c' });
        expect(parsedHeader[2]).toEqual({ fieldId: 1, timepoint: 3, measurement: 3, datatype: 'c' });
        expect(parsedHeader[3]).toEqual({ fieldId: 1, timepoint: 2, measurement: 1, datatype: 'c' });
        expect(parsedHeader[4]).toEqual({ fieldId: 2, timepoint: 3, measurement: 2, datatype: 'c' });
        expect(error).toBeDefined();
        expect(error.length).toBe(1);
        expect(error[0]).toBe('Object 1: There is duplicate (field, timepoint, measurement) combination.');
    });

    it('processJSONHeader function, user can annotate data type', () => {
        const exampleheader = ['Eid', '1@3.3:i', '1@3.3:c', '1@2.1:b', '2@3.2:c'];
        const { error, parsedHeader } = processJSONHeader(exampleheader);
        expect(parsedHeader.length).toBe(5);
        expect(parsedHeader[0]).toBeNull();
        expect(parsedHeader[1]).toEqual({ fieldId: 1, timepoint: 3, measurement: 3, datatype: 'i' });
        expect(parsedHeader[2]).toEqual({ fieldId: 1, timepoint: 3, measurement: 3, datatype: 'c' });
        expect(parsedHeader[3]).toEqual({ fieldId: 1, timepoint: 2, measurement: 1, datatype: 'b' });
        expect(parsedHeader[4]).toEqual({ fieldId: 2, timepoint: 3, measurement: 2, datatype: 'c' });
        expect(error).toBeDefined();
        expect(error.length).toBe(1);
        expect(error[0]).toBe('Object 1: There is duplicate (field, timepoint, measurement) combination.');
    });

    it('processJSONHeader function weeds out wrong data type', () => {
        const exampleheader = ['Eid', '1@3.3:p', '1@2.1:b', '2@3.2:e'];
        const { error, parsedHeader } = processJSONHeader(exampleheader);
        expect(parsedHeader.length).toBe(4);
        expect(parsedHeader[0]).toBeNull();
        expect(parsedHeader[1]).toBeNull();
        expect(parsedHeader[2]).toEqual({ fieldId: 1, timepoint: 2, measurement: 1, datatype: 'b' });
        expect(parsedHeader[3]).toBeNull();
        expect(error).toBeDefined();
        expect(error.length).toBe(2);
        expect(error[0]).toBe('Object 1: \'1@3.3:p\' is not a valid header field descriptor.');
        expect(error[1]).toBe('Object 1: \'2@3.2:e\' is not a valid header field descriptor.');
    });

    it('processJSONHeader function correctly parsed header', () => {
        const exampleheader = ['Eid', '1@3.3:c', '1@2.1:i', '2@3.2:b'];
        const { error, parsedHeader } = processJSONHeader(exampleheader);
        expect(parsedHeader.length).toBe(4);
        expect(parsedHeader[0]).toBeNull();
        expect(parsedHeader[1]).toEqual({ fieldId: 1, timepoint: 3, measurement: 3, datatype: 'c' });
        expect(parsedHeader[2]).toEqual({ fieldId: 1, timepoint: 2, measurement: 1, datatype: 'i' });
        expect(parsedHeader[3]).toEqual({ fieldId: 2, timepoint: 3, measurement: 2, datatype: 'b' });
        expect(error).toBeUndefined();
    });
});

describe('Unit tests for processEachSubject function', () => {
    const jobEntry = stub<IJobEntryForDataCuration>({  // subset of the IJobEntry interface
        id: 'mockJobId',
        studyId: 'mockStudyId',
        data: {
            dataVersion: '0.0.1',
            versionTag: 'testData'
        }
    });
    const templateParams = {
        objectNum: 22,
        subject: [],
        parsedHeader: processJSONHeader(['Eid', '1@3.3:c', '1@2.1:i', '2@3.2:b', '3@3.1:d']).parsedHeader,
        job: jobEntry,
        versionId: 'mockVersionId'
    };

    it('processEachSubject function correctly parse data row', () => {
        const { error, dataEntry } = processEachSubject({ ...templateParams, subject: ['A001', 'male', '95', 'true', '4.64'] });
        expect(error).toBeUndefined();
        expect(dataEntry).toEqual({
            m_eid: 'A001',
            m_jobId: 'mockJobId',
            m_study: 'mockStudyId',
            m_versionId: 'mockVersionId',
            1: { 2: { 1: 95 }, 3: { 3: 'male' } },
            2: { 3: { 2: true } },
            3: { 3: { 1: 4.64 } }
        });
    });

    it('processEachSubject function weeds out datatype mismatch', () => {
        const { error, dataEntry } = processEachSubject({ ...templateParams, subject: ['A001', 'male', 'female', 'male', '4.64'] });
        expect(error).toBeDefined();
        expect(error).toHaveLength(2);
        expect(error[0]).toBe('The 22 object (subjectId: A001) column 3: Cannot parse \'female\' as integer.');
        expect(error[1]).toBe('The 22 object (subjectId: A001) column 4: value for boolean type must be \'true\' or \'false\'.');
        expect(dataEntry).toEqual({
            m_eid: 'A001',
            m_jobId: 'mockJobId',
            m_study: 'mockStudyId',
            m_versionId: 'mockVersionId',
            1: { 3: { 3: 'male' } },
            3: { 3: { 1: 4.64 } }
        });
    });

    it('processEachSubject function weeds out datatype mismatch (2)', () => {
        const { error, dataEntry } = processEachSubject({ ...templateParams, subject: ['A001', '45', '53', 'false', '5a'] });
        expect(error).toBeDefined();
        expect(error).toHaveLength(1);
        expect(error[0]).toBe('The 22 object (subjectId: A001) column 5: Cannot parse \'5a\' as decimal.');
        expect(dataEntry).toEqual({
            m_eid: 'A001',
            m_jobId: 'mockJobId',
            m_study: 'mockStudyId',
            m_versionId: 'mockVersionId',
            1: { 2: { 1: 53 }, 3: { 3: '45' } },
            2: { 3: { 2: false } },
        });
    });

    it('processEachSubject function deals with missing value by skipping', () => {
        const { error, dataEntry } = processEachSubject({ ...templateParams, subject: ['A001', '', '', 'false', '5.96'] });
        expect(error).toBeUndefined();
        expect(dataEntry).toEqual({
            m_eid: 'A001',
            m_jobId: 'mockJobId',
            m_study: 'mockStudyId',
            m_versionId: 'mockVersionId',
            2: { 3: { 2: false } },
            3: { 3: { 1: 5.96 } }
        });
    });

    it('processEachSubject function deals with missing subject id correctly', () => {
        const { error, dataEntry } = processEachSubject({ ...templateParams, subject: ['', 'male', '53', 'false', '5.3'] });
        expect(error).toBeDefined();
        expect(error).toHaveLength(1);
        expect(error[0]).toBe('Object 22: No subject id provided.');
        expect(dataEntry).toEqual({
            m_jobId: 'mockJobId',
            m_study: 'mockStudyId',
            m_versionId: 'mockVersionId',
            1: { 2: { 1: 53 }, 3: { 3: 'male' } },
            2: { 3: { 2: false } },
            3: { 3: { 1: 5.3 } }
        });
    });
});

describe('JSONCuratorClass', () => {
    // should stop uploading when error occurs
    function BulkInsert() {
        this._insertArray = [];
        this._executeCalled = []; // array of length of _insertArray when execute() is called
        this.insert = (object) => { this._insertArray.push(object); };
        this.execute = () => new Promise((resolve) => {
            setTimeout(() => {
                this._executeCalled.push(this._insertArray.length);
                resolve();
            }, 10);
        });
    }

    function MongoStub() {
        this._bulkinsert = new BulkInsert();
        this.initializeUnorderedBulkOp = () => this._bulkinsert;
    }

    it('test mongostub', () => {
        const bulkinsert = (new MongoStub()).initializeUnorderedBulkOp();
        bulkinsert.insert({});
        bulkinsert.insert({});
        bulkinsert.execute().then(() => {
            bulkinsert.insert({});
            return bulkinsert.execute();
        }).then(() => {
            expect(bulkinsert._insertArray).toEqual([{}, {}, {}]);
            expect(bulkinsert._executeCalled).toEqual([2, 3]);
        });
    });

    it('jsoncurator uploads json file okay', async () => {
        const readStream = fs.createReadStream('./test/testFiles/JSONCurator.json');
        const mongoStub = new MongoStub();
        const jobEntry = stub<IJobEntryForDataCuration>({  // subset of the IJobEntry interface
            id: 'mockJobId',
            studyId: 'mockStudyId',
            data: {
                dataVersion: '0.0.1',
                versionTag: 'testData'
            }
        });
        const jsoncurator = new JSONCurator(
            mongoStub,
            readStream,
            jobEntry,
            'mockVersionId'
        );
        const errors = await jsoncurator.processIncomingStreamAndUploadToMongo();
        expect(errors).toEqual([]);
        expect(mongoStub._bulkinsert._insertArray).toHaveLength(2200);
        expect(mongoStub._bulkinsert._executeCalled).toEqual([1000, 2000, 2200]);
        expect(mongoStub._bulkinsert._insertArray[0]).toEqual({
            1: { 1: { 1: '1', 2: 2 }, 2: { 1: 2, } }, 2: { 1: { 1: 'male' } },
            m_eid: 'sub0',
            m_jobId: 'mockJobId',
            m_study: 'mockStudyId',
            m_versionId: 'mockVersionId'
        });

    }, 10000);

    it('jsoncurator catches wrong headers', async () => {
        const readStream = fs.createReadStream('./test/testFiles/JSONCurator_error1.json');
        const mongoStub = new MongoStub();
        const jobEntry = stub<IJobEntryForDataCuration>({  // subset of the IJobEntry interface
            id: 'mockJobId',
            studyId: 'mockStudyId',
            data: {
                dataVersion: '0.0.1',
                versionTag: 'testData'
            }
        });
        const jsoncurator = new JSONCurator(
            mongoStub,
            readStream,
            jobEntry,
            'mockVersionId'
        );
        const errors = await jsoncurator.processIncomingStreamAndUploadToMongo();
        expect(errors).toEqual([
            'Object 1: \'2@1.1:p\' is not a valid header field descriptor.',
            'Object 1: There is duplicate (field, timepoint, measurement) combination.',
        ]);
        expect(mongoStub._bulkinsert._insertArray).toHaveLength(0); // nothing gets uploaded if errors are caught in header
        expect(mongoStub._bulkinsert._executeCalled).toEqual([]);

    }, 10000);

    it('jsoncurator catches duplicate subject before first watermark', async () => {
        const readStream = fs.createReadStream('./test/testFiles/JSONCurator_error2.json');
        const mongoStub = new MongoStub();
        const jobEntry = stub<IJobEntryForDataCuration>({  // subset of the IJobEntry interface
            id: 'mockJobId',
            studyId: 'mockStudyId',
            data: {
                dataVersion: '0.0.1',
                versionTag: 'testData'
            }
        });
        const jsoncurator = new JSONCurator(
            mongoStub,
            readStream,
            jobEntry,
            'mockVersionId'
        );
        const errors = await jsoncurator.processIncomingStreamAndUploadToMongo();
        expect(errors).toEqual(['Data Error: There is duplicate subject id.']);
        expect(mongoStub._bulkinsert._insertArray).toHaveLength(2201);
        expect(mongoStub._bulkinsert._executeCalled).toEqual([1000, 2000]);
        expect(mongoStub._bulkinsert._insertArray[0]).toEqual({
            1: { 1: { 1: '1', 2: 2 }, 2: { 1: 2, } }, 2: { 1: { 1: 'male' } },
            m_eid: 'sub0',
            m_jobId: 'mockJobId',
            m_study: 'mockStudyId',
            m_versionId: 'mockVersionId'
        });

    }, 10000);

    it('jsoncurator catches uneven field before watermark', async () => {
        const readStream = fs.createReadStream('./test/testFiles/JSONCurator_error3.json');
        const mongoStub = new MongoStub();
        const jobEntry = stub<IJobEntryForDataCuration>({  // subset of the IJobEntry interface
            id: 'mockJobId',
            studyId: 'mockStudyId',
            data: {
                dataVersion: '0.0.1',
                versionTag: 'testData'
            }
        });
        const jsoncurator = new JSONCurator(
            mongoStub,
            readStream,
            jobEntry,
            'mockVersionId'
        );
        const errors = await jsoncurator.processIncomingStreamAndUploadToMongo();
        expect(errors).toEqual([
            'Object sub17: Uneven field Number; expected 5 fields but got 4',
            'Object sub27: Uneven field Number; expected 5 fields but got 4'
        ]);
        expect(mongoStub._bulkinsert._insertArray).toHaveLength(17);
        expect(mongoStub._bulkinsert._executeCalled).toEqual([]);
        expect(mongoStub._bulkinsert._insertArray[0]).toEqual({
            1: { 1: { 1: '1', 2: 2 }, 2: { 1: 2, } }, 2: { 1: { 1: 'male' } },
            m_eid: 'sub0',
            m_jobId: 'mockJobId',
            m_study: 'mockStudyId',
            m_versionId: 'mockVersionId'
        });

    }, 10000);

    it('jsoncurator catches uneven field after watermark', async () => {
        const readStream = fs.createReadStream('./test/testFiles/JSONCurator_error4.json');
        const mongoStub = new MongoStub();
        const jobEntry = stub<IJobEntryForDataCuration>({  // subset of the IJobEntry interface
            id: 'mockJobId',
            studyId: 'mockStudyId',
            data: {
                dataVersion: '0.0.1',
                versionTag: 'testData'
            }
        });
        const jsoncurator = new JSONCurator(
            mongoStub,
            readStream,
            jobEntry,
            'mockVersionId'
        );
        const errors = await jsoncurator.processIncomingStreamAndUploadToMongo();
        expect(errors).toEqual([
            'Object sub1530: Uneven field Number; expected 5 fields but got 3',
            'Object sub1836: Uneven field Number; expected 5 fields but got 4'
        ]);
        expect(mongoStub._bulkinsert._insertArray).toHaveLength(1530);
        expect(mongoStub._bulkinsert._executeCalled).toEqual([1000]);
        expect(mongoStub._bulkinsert._insertArray[0]).toEqual({
            1: { 1: { 1: '1', 2: 2 }, 2: { 1: 2, } }, 2: { 1: { 1: 'male' } },
            m_eid: 'sub0',
            m_jobId: 'mockJobId',
            m_study: 'mockStudyId',
            m_versionId: 'mockVersionId'
        });

    }, 10000);

    it('jsoncurator catches mixed errors', async () => {
        const readStream = fs.createReadStream('./test/testFiles/JSONCurator_error5.json');
        const mongoStub = new MongoStub();
        const jobEntry = stub<IJobEntryForDataCuration>({  // subset of the IJobEntry interface
            id: 'mockJobId',
            studyId: 'mockStudyId',
            data: {
                dataVersion: '0.0.1',
                versionTag: 'testData'
            }
        });
        const jsoncurator = new JSONCurator(
            mongoStub,
            readStream,
            jobEntry,
            'mockVersionId'
        );
        const errors = await jsoncurator.processIncomingStreamAndUploadToMongo();
        expect(errors).toEqual([
            'Object 1: \'1@2.1:8\' is not a valid header field descriptor.',
            'The 9 object (subjectId: sub7) column 3: Cannot parse \'as.d\' as decimal.',
            'Object sub31: Uneven field Number; expected 5 fields but got 4',
            'Object sub32: Uneven field Number; expected 5 fields but got 4',
            'Object sub1531: Uneven field Number; expected 5 fields but got 4',
            'Object sub1837: Uneven field Number; expected 5 fields but got 3',
            'Data Error: There is duplicate subject id.'
        ]);
        expect(mongoStub._bulkinsert._insertArray).toHaveLength(0);
        expect(mongoStub._bulkinsert._executeCalled).toEqual([]);
    }, 10000);

});
