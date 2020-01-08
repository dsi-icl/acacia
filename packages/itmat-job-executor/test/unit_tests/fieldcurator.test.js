const { processFieldRow, FieldCurator } = require('../../src/curation/FieldCurator');
const fs = require('fs');

describe('Unit tests for processFieldRow function', () => {
    const templateParams = {
        lineNum: 22,
        row: [],
        job: {  // subset of the IJobEntry interface
            id: 'mockJobId',
            studyId: 'mockStudyId',
            data: {
                dataVersionId: 'mockVersionId',
                tag: 'testFieldTree' 
            }
        },
        fieldTreeId: 'mockFieldTreeId'
    };

    it('processFieldRow function correctly parse data row', () => {
        const { error, dataEntry } = processFieldRow({ ...templateParams, row: [
            '42', 'Gender', 'C', 'Male,Female,Prefer not to say', '', 'Demographic>Baseline', '1', '1', '1', '1', 'Sex / Gender'
        ]});
        expect(error).toBeUndefined();
        expect(dataEntry.id).toBeDefined();
        expect(typeof dataEntry.id).toBe('string');
        expect(dataEntry.studyId).toBe('mockStudyId');
        expect(dataEntry.path).toBe('Demographic>Baseline');
        expect(dataEntry.fieldId).toBe(42);
        expect(dataEntry.fieldName).toBe('Gender');
        expect(dataEntry.valueType).toBe('C');
        expect(dataEntry.possibleValues).toBe(['Male', 'Female', 'Prefer not to say']);
        expect(dataEntry.unit).toBe('');
        expect(dataEntry.itemType).toBe('');
        expect(dataEntry.numOfTimePoints).toBe(1);
        expect(dataEntry.numOfMeasurements).toBe(1);
        expect(dataEntry.startingTimePoint).toBe(1);
        expect(dataEntry.startingMeasurement).toBe(1);
        expect(dataEntry.notes).toBe('Sex / Gender');
        expect(dataEntry.jobId).toBe('mockJobId');
        expect(dataEntry.deleted).toBe(null);
        expect(dataEntry.dateAdded).toBeDefined();
        expect(typeof dataEntry.dateAdded).toBe('number');
        expect(dataEntry.fieldTreeId).toBe(mockFieldTreeId);
    });

    it('processFieldRow function detects necessary fields that are empty', () => {
        const { error, dataEntry } = processFieldRow({ ...templateParams, row: [
            '42', '', 'C', 'Male,Female,Prefer not to say', '', 'Demographic>Baseline', '', '1', '1', '1', 'Sex / Gender'
        ] });
        expect(error).toBeDefined();
        expect(error).toHaveLength(2);
        expect(error[0]).toBe("Line 22 column 2: Field Name cannot be empty.");
        expect(error[1]).toBe("Line 22 column 7: Number of Time Points cannot be empty.");
        expect(dataEntry).toEqual({});
    });

    it('processFieldRow function requires possibleValues if valueType is "C"', () => {
        const { error, dataEntry } = processFieldRow({ ...templateParams, row: [
            '42', 'Gender', 'C', '', '', 'Demographic>Baseline', '1', '1', '1', '1', 'Sex / Gender'
        ] });
        expect(error).toBeDefined();
        expect(error).toHaveLength(1);
        expect(error[0]).toBe('Line 22 column 4: "Possible values" cannot be empty if value type is categorical.');
        expect(dataEntry).toEqual({});
    });

    it('processFieldRow function catches unparsable entries for supposed number', () => {
        const { error, dataEntry } = processFieldRow({ ...templateParams, row: [
            'fsl3', 'Gender', 'C', 'Male,Female,Prefer not to say', '', 'Demographic>Baseline', '1a', 'b1', '1', '1', 'Sex / Gender'
        ] });
        expect(error).toBeDefined();
        expect(error).toHaveLength(3);
        expect(error).toBe(`Line 22 column 1: Cannot parse field ID as number.`);
        expect(error).toBe(`Line 22 column 7: Cannot parse number of time points as number.`);
        expect(error).toBe(`Line 22 column 8: Cannot parse number of measurements as number.`);
        expect(dataEntry).toEqual({});
    });

    it('processFieldRow function catches invalid value type', () => {
        const { error, dataEntry } = processFieldRow({ ...templateParams, row: [
            '42', 'Gender', 'O', 'Male,Female,Prefer not to say', '', 'Demographic>Baseline', '1', '1', '1', '1', 'Sex / Gender'
        ] });
        expect(error).toBeDefined();
        expect(error).toHaveLength(1);
        expect(error).toBe('Line 22 column 3: Invalid value type: use "c" for categorical, "i" for integer, "d" for decimal, "b" for boolean and "t" for free text.');
        expect(dataEntry).toEqual({});
    });

    // it('processFieldRow catches all errors', () => {
    //     const { error, dataEntry } = processFieldRow({ ...templateParams, row: [
    //         '42', 'Gender', 'C', 'Male,Female,Prefer not to say', '', 'Demographic>Baseline', '1', '1', '1', '1', 'Sex / Gender'
    //     ] });
    //     expect(error).toBeDefined();
    //     expect(error).toHaveLength(1);
    //     expect(error).toBe('Line 22 column 3: Invalid value type: use "c" for categorical, "i" for integer, "d" for decimal, "b" for boolean and "t" for free text.');
    //     expect(dataEntry).toEqual({});
    // });
});

describe('FieldCuratorClass', () => {
    // should stop uploading when error occurs
    function BulkInsert() {
        this._insertArray = [];
        this._executeCalled = []; // array of length of _insertArray when execute() is called
        this.insert = (object) => { this._insertArray.push(object); };
        this.execute = () => new Promise((resolve, reject) => {
            setTimeout(() => {
                this._executeCalled.push(this._insertArray.length);
                resolve();
            }, 10);
        });
    }

    function MongoStub() {
        this._bulkinsert = new BulkInsert();
        this.initializeUnorderedBulkOp = () => this._bulkinsert;
    };

    it('test mongostub', () => {
        const bulkinsert = (new MongoStub).initializeUnorderedBulkOp();
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

    it('fieldcurator uploads csv file okay', async () => {
        const readStream = fs.createReadStream('./test/testFiles/FieldCurator.tsv');
        const mongoStub = new MongoStub();
        const fieldcurator = new FieldCurator(
            mongoStub,
            readStream,
            undefined,
            {  // subset of the IJobEntry interface
                id: 'mockJobId',
                studyId: 'mockStudyId',
                data: {
                    dataVersion: '0.0.1',
                    versionTag: 'testData' 
                }
            },
            'mockVersionId'
        );
        const errors = await fieldcurator.processIncomingStreamAndUploadToMongo();
        expect(errors).toEqual([]);
        expect(mongoStub._bulkinsert._insertArray).toHaveLength(2107);
        expect(mongoStub._bulkinsert._executeCalled).toEqual([1000, 2000, 2107]);
        expect(mongoStub._bulkinsert._insertArray[0]).toEqual({
            1: { 1: { 1: '1', 2: 2 }, 2: { 1: 2, } }, 2: { 1: { 1: 'male' } },
            m_eid: 'Subj1',
            m_jobId: 'mockJobId',
            m_study: 'mockStudyId',
            m_versionId: 'mockVersionId'
        });

    }, 10000);

    it('fieldcurator catches duplicate fieldId before first watermark', async () => {
        const readStream = fs.createReadStream('./test/testFiles/FieldCurator_error2.tsv');
        const mongoStub = new MongoStub();
        const fieldcurator = new FieldCurator(
            mongoStub,
            readStream,
            undefined,
            {  // subset of the IJobEntry interface
                id: 'mockJobId',
                studyId: 'mockStudyId',
                data: {
                    dataVersion: '0.0.1',
                    versionTag: 'testData' 
                }
            },
            'mockVersionId'
        );
        const errors = await fieldcurator.processIncomingStreamAndUploadToMongo();
        expect(errors).toEqual(['Data Error: There is duplicate subject id.']);
        expect(mongoStub._bulkinsert._insertArray).toHaveLength(2108);
        expect(mongoStub._bulkinsert._executeCalled).toEqual([1000, 2000, 2108]);
        expect(mongoStub._bulkinsert._insertArray[0]).toEqual({
            1: { 1: { 1: '1', 2: 2 }, 2: { 1: 2, } }, 2: { 1: { 1: 'male' } },
            m_eid: 'Subj1',
            m_jobId: 'mockJobId',
            m_study: 'mockStudyId',
            m_versionId: 'mockVersionId'
        });

    }, 10000);

    it('fieldcurator catches uneven field before watermark', async () => {
        const readStream = fs.createReadStream('./test/testFiles/FieldCurator_error3.tsv');
        const mongoStub = new MongoStub();
        const fieldcurator = new FieldCurator(
            mongoStub,
            readStream,
            undefined,
            {  // subset of the IJobEntry interface
                id: 'mockJobId',
                studyId: 'mockStudyId',
                data: {
                    dataVersion: '0.0.1',
                    versionTag: 'testData' 
                }
            },
            'mockVersionId'
        );

        const errors = await fieldcurator.processIncomingStreamAndUploadToMongo();
        expect(errors).toEqual([
            "Line 18: Uneven field Number; expected 5 fields but got 4",
            "Line 28: Uneven field Number; expected 5 fields but got 4"
        ]);
        expect(mongoStub._bulkinsert._insertArray).toHaveLength(16);
        expect(mongoStub._bulkinsert._executeCalled).toEqual([]);
        expect(mongoStub._bulkinsert._insertArray[0]).toEqual({
            1: { 1: { 1: '1', 2: 2 }, 2: { 1: 2, } }, 2: { 1: { 1: 'male' } },
            m_eid: 'Subj1',
            m_jobId: 'mockJobId',
            m_study: 'mockStudyId',
            m_versionId: 'mockVersionId'
        });

    }, 10000);

    it('fieldcurator catches uneven field after watermark', async () => {
        const readStream = fs.createReadStream('./test/testFiles/FieldCurator_error4.tsv');
        const mongoStub = new MongoStub();
        const fieldcurator = new FieldCurator(
            mongoStub,
            readStream,
            undefined,
            {  // subset of the IJobEntry interface
                id: 'mockJobId',
                studyId: 'mockStudyId',
                data: {
                    dataVersion: '0.0.1',
                    versionTag: 'testData' 
                }
            },
            'mockVersionId'
        );

        const errors = await fieldcurator.processIncomingStreamAndUploadToMongo();
        expect(errors).toEqual([
            "Line 1530: Uneven field Number; expected 5 fields but got 3",
            "Line 1836: Uneven field Number; expected 5 fields but got 4"
        ]);
        expect(mongoStub._bulkinsert._insertArray).toHaveLength(1528);
        expect(mongoStub._bulkinsert._executeCalled).toEqual([1000]);
        expect(mongoStub._bulkinsert._insertArray[0]).toEqual({
            1: { 1: { 1: '1', 2: 2 }, 2: { 1: 2, } }, 2: { 1: { 1: 'male' } },
            m_eid: 'Subj1',
            m_jobId: 'mockJobId',
            m_study: 'mockStudyId',
            m_versionId: 'mockVersionId'
        });

    }, 10000);

    it('fieldcurator catches mixed errors', async () => {
        const readStream = fs.createReadStream('./test/testFiles/FieldCurator_error5.tsv');
        const mongoStub = new MongoStub();
        const fieldcurator = new FieldCurator(
            mongoStub,
            readStream,
            undefined,
            {  // subset of the IJobEntry interface
                id: 'mockJobId',
                studyId: 'mockStudyId',
                data: {
                    dataVersion: '0.0.1',
                    versionTag: 'testData' 
                }
            },
            'mockVersionId'
        );

        const errors = await fieldcurator.processIncomingStreamAndUploadToMongo();
        expect(errors).toEqual([
            "Line 1: '1@2.1:8' is not a valid header field descriptor.",
            "Line 7 column 3: Cannot parse 'as.d' as decimal.",
            "Line 31: Uneven field Number; expected 5 fields but got 4",
            "Line 32: Uneven field Number; expected 5 fields but got 4",
            "Line 1531: Uneven field Number; expected 5 fields but got 3",
            "Line 1837: Uneven field Number; expected 5 fields but got 4",
            "Data Error: There is duplicate subject id."
        ]);
        expect(mongoStub._bulkinsert._insertArray).toHaveLength(0);
        expect(mongoStub._bulkinsert._executeCalled).toEqual([]);
    }, 10000);
});