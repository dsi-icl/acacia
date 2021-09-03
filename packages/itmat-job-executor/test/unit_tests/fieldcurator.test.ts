import { processFieldRow, FieldCurator } from '../../src/curation/FieldCurator';
import fs from 'fs';
import { IJobEntryForFieldCuration, IJobEntry } from 'itmat-commons';
import { stub } from './_stubHelper';

describe('Unit tests for processFieldRow function', () => {
    const job = stub<IJobEntryForFieldCuration>({  // subset of the IJobEntry interface
        id: 'mockJobId',
        studyId: 'mockStudyId',
        data: {
            dataVersionId: 'mockVersionId',
            tag: 'testFieldTree'
        }
    });
    const templateParams = {
        lineNum: 22,
        row: [],
        job,
        fieldTreeId: 'mockFieldTreeId'
    };

    it('processFieldRow function correctly parse data row', () => {
        const { error, dataEntry } = processFieldRow(stub<any>({
            ...templateParams, row: [
                '42', 'Gender', 'c', 'Male,Female,Prefer not to say', '', 'Demographic>Baseline', '1', '1', '1', '1', 'Sex / Gender'
            ]
        }));
        expect(error).toBeUndefined();
        expect(dataEntry.id).toBeDefined();
        expect(typeof dataEntry.id).toBe('string');
        expect(dataEntry.studyId).toBe('mockStudyId');
        expect(dataEntry.path).toBe('Demographic>Baseline');
        expect(dataEntry.fieldId).toBe(42);
        expect(dataEntry.fieldName).toBe('Gender');
        expect(dataEntry.valueType).toBe('c');
        expect(dataEntry.possibleValues).toEqual(['Male', 'Female', 'Prefer not to say']);
        expect(dataEntry.unit).toBe('');
        expect(dataEntry.itemType).toBe('C');
        expect(dataEntry.numOfTimePoints).toBe(1);
        expect(dataEntry.numOfMeasurements).toBe(1);
        expect(dataEntry.startingTimePoint).toBe(1);
        expect(dataEntry.startingMeasurement).toBe(1);
        expect(dataEntry.notes).toBe('Sex / Gender');
        expect(dataEntry.jobId).toBe('mockJobId');
        expect(dataEntry.deleted).toBe(null);
        expect(dataEntry.dateAdded).toBeDefined();
        expect(typeof dataEntry.dateAdded).toBe('number');
        expect(dataEntry.fieldTreeId).toBe('mockFieldTreeId');
    });

    it('processFieldRow function detects necessary fields that are empty', () => {
        const { error, dataEntry } = processFieldRow(stub<any>({
            ...templateParams, row: [
                '42', '', 'c', 'Male,Female,Prefer not to say', '', 'Demographic>Baseline', '', '1', '1', '1', 'Sex / Gender'
            ]
        }));
        expect(error).toBeDefined();
        expect(error).toHaveLength(2);
        expect(error[0]).toBe('Line 22 column 2: Field Name cannot be empty.');
        expect(error[1]).toBe('Line 22 column 7: Number of Time Points cannot be empty.');
        expect(dataEntry).toEqual({});
    });

    it('processFieldRow function detects uneven fields', () => {
        const { error, dataEntry } = processFieldRow(stub<any>({
            ...templateParams, row: [
                '42', 'Fieldname', 'c', 'Demographic>Baseline', '3', '1', '1', '1', 'Sex / Gender'
            ]
        }));
        expect(error).toBeDefined();
        expect(error).toHaveLength(1);
        expect(error[0]).toBe('Line 22: Uneven field Number; expected 11 fields but got 9.');
        expect(dataEntry).toEqual({});
    });

    it('processFieldRow function requires possibleValues if valueType is "C"', () => {
        const { error, dataEntry } = processFieldRow(stub<any>({
            ...templateParams, row: [
                '42', 'Gender', 'c', '', '', 'Demographic>Baseline', '1', '1', '1', '1', 'Sex / Gender'
            ]
        }));
        expect(error).toBeDefined();
        expect(error).toHaveLength(1);
        expect(error[0]).toBe('Line 22 column 4: "Possible values" cannot be empty if value type is categorical.');
        expect(dataEntry).toEqual({});
    });

    it('processFieldRow function catches unparsable entries for supposed number', () => {
        const { error, dataEntry } = processFieldRow(stub<any>({
            ...templateParams, row: [
                'fsl3', 'Gender', 'c', 'Male,Female,Prefer not to say', '', 'Demographic>Baseline', '1a', 'b1', '1', '1', 'Sex / Gender'
            ]
        }));
        expect(error).toBeDefined();
        expect(error).toHaveLength(3);
        expect(error[0]).toBe('Line 22 column 1: Cannot parse field ID as number.');
        expect(error[1]).toBe('Line 22 column 7: Cannot parse number of time points as number.');
        expect(error[2]).toBe('Line 22 column 8: Cannot parse number of measurements as number.');
        expect(dataEntry).toEqual({});
    });

    it('processFieldRow function catches invalid value type', () => {
        const { error, dataEntry } = processFieldRow(stub<any>({
            ...templateParams, row: [
                '42', 'Gender', 'O', 'Male,Female,Prefer not to say', '', 'Demographic>Baseline', '1', '1', '1', '1', 'Sex / Gender'
            ]
        }));
        expect(error).toBeDefined();
        expect(error).toHaveLength(1);
        expect(error[0]).toBe('Line 22 column 3: Invalid value type "O": use "c" for categorical, "i" for integer, "d" for decimal, "b" for boolean and "t" for free text.');
        expect(dataEntry).toEqual({});
    });
});

describe('FieldCuratorClass', () => {
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

    it('fieldcurator uploads csv file < 1000 fields okay', async () => {
        const readStream = fs.createReadStream('./test/testFiles/FieldCurator.tsv');
        const mongoStub = new MongoStub();
        const jobEntry = stub<IJobEntryForFieldCuration>({  // subset of the IJobEntry interface
            id: 'mockJobId',
            studyId: 'mockStudyId',
            data: {
                dataVersionId: 'mockDataVersionId',
                tag: 'mockTag'
            }
        });
        const fieldcurator = new FieldCurator(
            mongoStub,
            readStream,
            undefined,
            jobEntry,
            'mockFieldTreeId'
        );
        const errors = await fieldcurator.processIncomingStreamAndUploadToMongo();
        expect(errors).toEqual([]);
        expect(mongoStub._bulkinsert._insertArray).toHaveLength(26);
        expect(mongoStub._bulkinsert._executeCalled).toEqual([26]);
        expect(mongoStub._bulkinsert._insertArray[0].id).toBeDefined();
        expect(typeof mongoStub._bulkinsert._insertArray[0].id).toBe('string');
        expect(mongoStub._bulkinsert._insertArray[0].studyId).toBe('mockStudyId');
        expect(mongoStub._bulkinsert._insertArray[0].path).toBe('Demographics>Baseline');
        expect(mongoStub._bulkinsert._insertArray[0].fieldId).toBe(42);
        expect(mongoStub._bulkinsert._insertArray[0].fieldName).toBe('field_name1');
        expect(mongoStub._bulkinsert._insertArray[0].valueType).toBe('c');
        expect(mongoStub._bulkinsert._insertArray[0].possibleValues).toEqual(['Male', 'Female']);
        expect(mongoStub._bulkinsert._insertArray[0].unit).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].itemType).toBe('C');
        expect(mongoStub._bulkinsert._insertArray[0].numOfTimePoints).toBe(1);
        expect(mongoStub._bulkinsert._insertArray[0].numOfMeasurements).toBe(1);
        expect(mongoStub._bulkinsert._insertArray[0].startingTimePoint).toBe(1);
        expect(mongoStub._bulkinsert._insertArray[0].startingMeasurement).toBe(1);
        expect(mongoStub._bulkinsert._insertArray[0].notes).toBe('Sex/Gender');
        expect(mongoStub._bulkinsert._insertArray[0].jobId).toBe('mockJobId');
        expect(mongoStub._bulkinsert._insertArray[0].deleted).toBe(null);
        expect(mongoStub._bulkinsert._insertArray[0].dateAdded).toBeDefined();
        expect(typeof mongoStub._bulkinsert._insertArray[0].dateAdded).toBe('number');
        expect(mongoStub._bulkinsert._insertArray[0].fieldTreeId).toBe('mockFieldTreeId');
    }, 10000);

    it('fieldcurator uploads csv file > 1000 fields okay', async () => {
        const readStream = fs.createReadStream('./test/testFiles/FieldCurator_1000.tsv');
        const mongoStub = new MongoStub();
        const jobEntry = stub<IJobEntryForFieldCuration>({  // subset of the IJobEntry interface
            id: 'mockJobId',
            studyId: 'mockStudyId',
            data: {
                dataVersionId: 'mockDataVersionId',
                tag: 'mockTag'
            }
        });
        const fieldcurator = new FieldCurator(
            mongoStub,
            readStream,
            undefined,
            jobEntry,
            'mockFieldTreeId'
        );
        const errors = await fieldcurator.processIncomingStreamAndUploadToMongo();
        expect(errors).toEqual([]);
        expect(mongoStub._bulkinsert._insertArray).toHaveLength(1275);
        expect(mongoStub._bulkinsert._executeCalled).toEqual([1000, 1275]);
        expect(mongoStub._bulkinsert._insertArray[0].id).toBeDefined();
        expect(typeof mongoStub._bulkinsert._insertArray[0].id).toBe('string');
        expect(mongoStub._bulkinsert._insertArray[0].studyId).toBe('mockStudyId');
        expect(mongoStub._bulkinsert._insertArray[0].path).toBe('Demographics>Baseline');
        expect(mongoStub._bulkinsert._insertArray[0].fieldId).toBe(42);
        expect(mongoStub._bulkinsert._insertArray[0].fieldName).toBe('field_name1');
        expect(mongoStub._bulkinsert._insertArray[0].valueType).toBe('c');
        expect(mongoStub._bulkinsert._insertArray[0].possibleValues).toEqual(['Male', 'Female']);
        expect(mongoStub._bulkinsert._insertArray[0].unit).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].itemType).toBe('C');
        expect(mongoStub._bulkinsert._insertArray[0].numOfTimePoints).toBe(1);
        expect(mongoStub._bulkinsert._insertArray[0].numOfMeasurements).toBe(4);
        expect(mongoStub._bulkinsert._insertArray[0].startingTimePoint).toBe(1);
        expect(mongoStub._bulkinsert._insertArray[0].startingMeasurement).toBe(2);
        expect(mongoStub._bulkinsert._insertArray[0].notes).toBe('Sex/Gender');
        expect(mongoStub._bulkinsert._insertArray[0].jobId).toBe('mockJobId');
        expect(mongoStub._bulkinsert._insertArray[0].deleted).toBe(null);
        expect(mongoStub._bulkinsert._insertArray[0].dateAdded).toBeDefined();
        expect(typeof mongoStub._bulkinsert._insertArray[0].dateAdded).toBe('number');
        expect(mongoStub._bulkinsert._insertArray[0].fieldTreeId).toBe('mockFieldTreeId');
    }, 10000);

    it('fieldcurator catches duplicate fieldId before first watermark', async () => {
        const readStream = fs.createReadStream('./test/testFiles/FieldCurator_error1.tsv');
        const mongoStub = new MongoStub();
        const jobEntry = stub<IJobEntryForFieldCuration>({  // subset of the IJobEntry interface
            id: 'mockJobId',
            studyId: 'mockStudyId',
            data: {
                dataVersionId: 'mockDataVersionId',
                tag: 'mockTag'
            }
        });
        const fieldcurator = new FieldCurator(
            mongoStub,
            readStream,
            undefined,
            jobEntry,
            'mockFieldTreeId'
        );
        const errors = await fieldcurator.processIncomingStreamAndUploadToMongo();
        expect(errors).toEqual(['Data Error: There is duplicate field id.']);
        expect(mongoStub._bulkinsert._insertArray).toHaveLength(1275);
        expect(mongoStub._bulkinsert._executeCalled).toEqual([1000]);
        expect(mongoStub._bulkinsert._insertArray[0].id).toBeDefined();
        expect(typeof mongoStub._bulkinsert._insertArray[0].id).toBe('string');
        expect(mongoStub._bulkinsert._insertArray[0].studyId).toBe('mockStudyId');
        expect(mongoStub._bulkinsert._insertArray[0].path).toBe('Demographics>Baseline');
        expect(mongoStub._bulkinsert._insertArray[0].fieldId).toBe(42);
        expect(mongoStub._bulkinsert._insertArray[0].fieldName).toBe('field_name1');
        expect(mongoStub._bulkinsert._insertArray[0].valueType).toBe('c');
        expect(mongoStub._bulkinsert._insertArray[0].possibleValues).toEqual(['Male', 'Female']);
        expect(mongoStub._bulkinsert._insertArray[0].unit).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].itemType).toBe('C');
        expect(mongoStub._bulkinsert._insertArray[0].numOfTimePoints).toBe(1);
        expect(mongoStub._bulkinsert._insertArray[0].numOfMeasurements).toBe(4);
        expect(mongoStub._bulkinsert._insertArray[0].startingTimePoint).toBe(1);
        expect(mongoStub._bulkinsert._insertArray[0].startingMeasurement).toBe(2);
        expect(mongoStub._bulkinsert._insertArray[0].notes).toBe('Sex/Gender');
        expect(mongoStub._bulkinsert._insertArray[0].jobId).toBe('mockJobId');
        expect(mongoStub._bulkinsert._insertArray[0].deleted).toBe(null);
        expect(mongoStub._bulkinsert._insertArray[0].dateAdded).toBeDefined();
        expect(typeof mongoStub._bulkinsert._insertArray[0].dateAdded).toBe('number');
        expect(mongoStub._bulkinsert._insertArray[0].fieldTreeId).toBe('mockFieldTreeId');
    }, 10000);

    it('fieldcurator catches duplicate fieldId after first watermark', async () => {
        const readStream = fs.createReadStream('./test/testFiles/FieldCurator_error2.tsv');
        const mongoStub = new MongoStub();
        const jobEntry = stub<IJobEntryForFieldCuration>({  // subset of the IJobEntry interface
            id: 'mockJobId',
            studyId: 'mockStudyId',
            data: {
                dataVersionId: 'mockDataVersionId',
                tag: 'mockTag'
            }
        });
        const fieldcurator = new FieldCurator(
            mongoStub,
            readStream,
            undefined,
            jobEntry,
            'mockFieldTreeId'
        );
        const errors = await fieldcurator.processIncomingStreamAndUploadToMongo();
        expect(errors).toEqual(['Data Error: There is duplicate field id.']);
        expect(mongoStub._bulkinsert._insertArray).toHaveLength(1275);
        expect(mongoStub._bulkinsert._executeCalled).toEqual([1000]);
        expect(mongoStub._bulkinsert._insertArray[0].id).toBeDefined();
        expect(typeof mongoStub._bulkinsert._insertArray[0].id).toBe('string');
        expect(mongoStub._bulkinsert._insertArray[0].studyId).toBe('mockStudyId');
        expect(mongoStub._bulkinsert._insertArray[0].path).toBe('Demographics>Baseline');
        expect(mongoStub._bulkinsert._insertArray[0].fieldId).toBe(42);
        expect(mongoStub._bulkinsert._insertArray[0].fieldName).toBe('field_name1');
        expect(mongoStub._bulkinsert._insertArray[0].valueType).toBe('c');
        expect(mongoStub._bulkinsert._insertArray[0].possibleValues).toEqual(['Male', 'Female']);
        expect(mongoStub._bulkinsert._insertArray[0].unit).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].itemType).toBe('C');
        expect(mongoStub._bulkinsert._insertArray[0].numOfTimePoints).toBe(1);
        expect(mongoStub._bulkinsert._insertArray[0].numOfMeasurements).toBe(4);
        expect(mongoStub._bulkinsert._insertArray[0].startingTimePoint).toBe(1);
        expect(mongoStub._bulkinsert._insertArray[0].startingMeasurement).toBe(2);
        expect(mongoStub._bulkinsert._insertArray[0].notes).toBe('Sex/Gender');
        expect(mongoStub._bulkinsert._insertArray[0].jobId).toBe('mockJobId');
        expect(mongoStub._bulkinsert._insertArray[0].deleted).toBe(null);
        expect(mongoStub._bulkinsert._insertArray[0].dateAdded).toBeDefined();
        expect(typeof mongoStub._bulkinsert._insertArray[0].dateAdded).toBe('number');
        expect(mongoStub._bulkinsert._insertArray[0].fieldTreeId).toBe('mockFieldTreeId');
    }, 10000);

    it('fieldcurator catches uneven field before watermark', async () => {
        const readStream = fs.createReadStream('./test/testFiles/FieldCurator_error3.tsv');
        const mongoStub = new MongoStub();
        const jobEntry = stub<IJobEntryForFieldCuration>({  // subset of the IJobEntry interface
            id: 'mockJobId',
            studyId: 'mockStudyId',
            data: {
                dataVersionId: 'mockDataVersionId',
                tag: 'mockTag'
            }
        });
        const fieldcurator = new FieldCurator(
            mongoStub,
            readStream,
            undefined,
            jobEntry,
            'mockFieldTreeId'
        );
        const errors = await fieldcurator.processIncomingStreamAndUploadToMongo();
        expect(errors).toEqual(['Line 24: Uneven field Number; expected 11 fields but got 9.']);
        expect(mongoStub._bulkinsert._insertArray).toHaveLength(22);
        expect(mongoStub._bulkinsert._executeCalled).toEqual([]);
        expect(mongoStub._bulkinsert._insertArray[0].id).toBeDefined();
        expect(typeof mongoStub._bulkinsert._insertArray[0].id).toBe('string');
        expect(mongoStub._bulkinsert._insertArray[0].studyId).toBe('mockStudyId');
        expect(mongoStub._bulkinsert._insertArray[0].path).toBe('Demographics>Baseline');
        expect(mongoStub._bulkinsert._insertArray[0].fieldId).toBe(42);
        expect(mongoStub._bulkinsert._insertArray[0].fieldName).toBe('field_name1');
        expect(mongoStub._bulkinsert._insertArray[0].valueType).toBe('c');
        expect(mongoStub._bulkinsert._insertArray[0].possibleValues).toEqual(['Male', 'Female']);
        expect(mongoStub._bulkinsert._insertArray[0].unit).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].itemType).toBe('C');
        expect(mongoStub._bulkinsert._insertArray[0].numOfTimePoints).toBe(1);
        expect(mongoStub._bulkinsert._insertArray[0].numOfMeasurements).toBe(4);
        expect(mongoStub._bulkinsert._insertArray[0].startingTimePoint).toBe(1);
        expect(mongoStub._bulkinsert._insertArray[0].startingMeasurement).toBe(2);
        expect(mongoStub._bulkinsert._insertArray[0].notes).toBe('Sex/Gender');
        expect(mongoStub._bulkinsert._insertArray[0].jobId).toBe('mockJobId');
        expect(mongoStub._bulkinsert._insertArray[0].deleted).toBe(null);
        expect(mongoStub._bulkinsert._insertArray[0].dateAdded).toBeDefined();
        expect(typeof mongoStub._bulkinsert._insertArray[0].dateAdded).toBe('number');
        expect(mongoStub._bulkinsert._insertArray[0].fieldTreeId).toBe('mockFieldTreeId');
    }, 10000);

    it('fieldcurator catches uneven field after watermark', async () => {
        const readStream = fs.createReadStream('./test/testFiles/FieldCurator_error4.tsv');
        const mongoStub = new MongoStub();
        const jobEntry = stub<IJobEntryForFieldCuration>({  // subset of the IJobEntry interface
            id: 'mockJobId',
            studyId: 'mockStudyId',
            data: {
                dataVersionId: 'mockDataVersionId',
                tag: 'mockTag'
            }
        });
        const fieldcurator = new FieldCurator(
            mongoStub,
            readStream,
            undefined,
            jobEntry,
            'mockFieldTreeId'
        );
        const errors = await fieldcurator.processIncomingStreamAndUploadToMongo();
        expect(errors).toEqual(['Line 1121: Uneven field Number; expected 11 fields but got 10.']);
        expect(mongoStub._bulkinsert._insertArray).toHaveLength(1119);
        expect(mongoStub._bulkinsert._executeCalled).toEqual([1000]);
        expect(mongoStub._bulkinsert._insertArray[0].id).toBeDefined();
        expect(typeof mongoStub._bulkinsert._insertArray[0].id).toBe('string');
        expect(mongoStub._bulkinsert._insertArray[0].studyId).toBe('mockStudyId');
        expect(mongoStub._bulkinsert._insertArray[0].path).toBe('Demographics>Baseline');
        expect(mongoStub._bulkinsert._insertArray[0].fieldId).toBe(42);
        expect(mongoStub._bulkinsert._insertArray[0].fieldName).toBe('field_name1');
        expect(mongoStub._bulkinsert._insertArray[0].valueType).toBe('c');
        expect(mongoStub._bulkinsert._insertArray[0].possibleValues).toEqual(['Male', 'Female']);
        expect(mongoStub._bulkinsert._insertArray[0].unit).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].itemType).toBe('C');
        expect(mongoStub._bulkinsert._insertArray[0].numOfTimePoints).toBe(1);
        expect(mongoStub._bulkinsert._insertArray[0].numOfMeasurements).toBe(4);
        expect(mongoStub._bulkinsert._insertArray[0].startingTimePoint).toBe(1);
        expect(mongoStub._bulkinsert._insertArray[0].startingMeasurement).toBe(2);
        expect(mongoStub._bulkinsert._insertArray[0].notes).toBe('Sex/Gender');
        expect(mongoStub._bulkinsert._insertArray[0].jobId).toBe('mockJobId');
        expect(mongoStub._bulkinsert._insertArray[0].deleted).toBe(null);
        expect(mongoStub._bulkinsert._insertArray[0].dateAdded).toBeDefined();
        expect(typeof mongoStub._bulkinsert._insertArray[0].dateAdded).toBe('number');
        expect(mongoStub._bulkinsert._insertArray[0].fieldTreeId).toBe('mockFieldTreeId');
    }, 10000);

    it('fieldcurator catches mixed errors', async () => {
        const readStream = fs.createReadStream('./test/testFiles/FieldCurator_error5.tsv');
        const mongoStub = new MongoStub();
        const jobEntry = stub<IJobEntry<any>>({  // subset of the IJobEntry interface
            id: 'mockJobId',
            studyId: 'mockStudyId',
            data: {
                dataVersion: '0.0.1',
                versionTag: 'testData'
            }
        });
        const fieldcurator = new FieldCurator(
            mongoStub,
            readStream,
            undefined,
            jobEntry,
            'mockVersionId'
        );

        const errors = await fieldcurator.processIncomingStreamAndUploadToMongo();
        expect(errors).toEqual([
            'Line 9 column 2: Field Name cannot be empty.',
            'Line 69: Uneven field Number; expected 11 fields but got 10.',
            'Line 331 column 3: Invalid value type "w": use "c" for categorical, "i" for integer, "d" for decimal, "b" for boolean and "t" for free text.',
            'Line 835 column 7: Cannot parse number of time points as number.',
            'Line 919 column 1: Cannot parse field ID as number.',
            'Data Error: There is duplicate field id.'
        ]);
        expect(mongoStub._bulkinsert._insertArray).toHaveLength(7);
        expect(mongoStub._bulkinsert._executeCalled).toEqual([]);
    }, 10000);
});
