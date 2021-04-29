import { processFieldRow, FieldCurator } from '../../src/curation/FieldCurator';
import fs from 'fs';
import { IJobEntryForFieldCuration, IJobEntry, enumValueType } from 'itmat-commons';
import { stub } from './_stubHelper';

describe('Unit tests for processFieldRow function', () => {
    const job = stub<IJobEntryForFieldCuration>({  // subset of the IJobEntry interface
        id: 'mockJobId',
        studyId: 'mockStudyId',
        data: {
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
                '564','IDEAFAST','Participants','','','','SubjectID','Subject ID','','','','','','','','','','nvarchar','','False','','9','','True','False','True','','False','','','','False',''
            ]
        }));
        expect(error).toBeUndefined();
        expect(dataEntry.id).toBeDefined();
        expect(typeof dataEntry.id).toBe('string');
        expect(dataEntry.fieldId).toBe(564);
        expect(dataEntry.database).toBe('IDEAFAST');
        expect(dataEntry.tableName).toBe('Participants');
        expect(dataEntry.tableId).toBe('');
        expect(dataEntry.sequentialOrder).toBe('');
        expect(dataEntry.questionNumber).toBe('');
        expect(dataEntry.fieldName).toBe('SubjectID');
        expect(dataEntry.label).toBe('Subject ID');
        expect(dataEntry.labelDe).toBe('');
        expect(dataEntry.labelNl).toBe('');
        expect(dataEntry.labelIt).toBe('');
        expect(dataEntry.labelEs).toBe('');
        expect(dataEntry.labelPl).toBe('');
        expect(dataEntry.labelF).toBe('');
        expect(dataEntry.eligibleAnswer).toBe('');
        expect(dataEntry.ineligibleAnswer).toBe('');
        expect(dataEntry.validation).toBe('');
        expect(dataEntry.dataType).toBe(enumValueType.STRING);
        expect(dataEntry.controlType).toBe('');
        expect(dataEntry.systemGenerated).toBe(false);
        expect(dataEntry.valueList).toBe('');
        expect(dataEntry.length).toBe(9);
        expect(dataEntry.displayFormat).toBe('');
        expect(dataEntry.nullable).toBe(true);
        expect(dataEntry.required).toBe(false);
        expect(dataEntry.mandatory).toBe(true);
        expect(dataEntry.collectIf).toBe('');
        expect(dataEntry.notMapped).toBe(false);
        expect(dataEntry.defaultValue).toBe('');
        expect(dataEntry.regEx).toBe('');
        expect(dataEntry.regExErrorMsg).toBe('');
        expect(dataEntry.showOnIndexView).toBe(false);
        expect(dataEntry.comments).toBe('');
        expect(dataEntry.jobId).toBe('mockJobId');
        expect(dataEntry.deleted).toBe(null);
        expect(typeof dataEntry.dateAdded).toBe('number');
        expect(dataEntry.fieldTreeId).toBe('mockFieldTreeId');
    });

    it('processFieldRow function detects necessary fields that are empty', () => {
        const { error, dataEntry } = processFieldRow(stub<any>({
            ...templateParams, row: [
                '','IDEAFAST','Participants','','','','','Subject ID','','','','','','','','','','nvarchar','','False','','9','','True','False','True','','False','','','','False',''
            ]
        }));
        expect(error).toBeDefined();
        expect(error).toHaveLength(2);
        expect(error[0]).toBe('Line 22 column 1: FieldID cannot be empty.');
        expect(error[1]).toBe('Line 22 column 7: Field Name cannot be empty.');
        expect(dataEntry).toEqual({});
    });

    it('processFieldRow function detects uneven fields', () => {
        const { error, dataEntry } = processFieldRow(stub<any>({
            ...templateParams, row: [
                '564','IDEAFAST','Participants','','','','SubjectID','Subject ID','','','','','','','','','','nvarchar','','False','','9','','True','False','True','False','','','','False'
            ]
        }));
        expect(error).toBeDefined();
        expect(error).toHaveLength(1);
        expect(error[0]).toBe('Line 22: Uneven field Number; expected 33 fields but got 31.');
        expect(dataEntry).toEqual({});
    });

    // it('processFieldRow function requires possibleValues if valueType is "C"', () => {
    //     const { error, dataEntry } = processFieldRow(stub<any>({
    //         ...templateParams, row: [
    //             '42', 'Gender', 'c', '', '', 'Demographic>Baseline', '1', '1', '1', '1', 'Sex / Gender'
    //         ]
    //     }));
    //     expect(error).toBeDefined();
    //     expect(error).toHaveLength(1);
    //     expect(error[0]).toBe('Line 22 column 4: "Possible values" cannot be empty if value type is categorical.');
    //     expect(dataEntry).toEqual({});
    // });

    it('processFieldRow function catches unparsable entries for supposed number', () => {
        const { error, dataEntry } = processFieldRow(stub<any>({
            ...templateParams, row: [
                '564A','IDEAFAST','Participants','','','','SubjectID','Subject ID','','','','','','','','','','nvarchar','','False','','9A','','True','False','True','','False','','','','False',''
            ]
        }));
        expect(error).toBeDefined();
        expect(error).toHaveLength(2);
        expect(error[0]).toBe('Line 22 column 1: Cannot parse field ID as number.');
        expect(error[1]).toBe('Line 22 column 22: Cannot parse length of characters as number.');
        expect(dataEntry).toEqual({});
    });

    it('processFieldRow function catches invalid value type', () => {
        const { error, dataEntry } = processFieldRow(stub<any>({
            ...templateParams, row: [
                '564','IDEAFAST','Participants','','','','SubjectID','Subject ID','','','','','','','','','','str','','False','','9','','True','False','True','','False','','','','False',''
            ]
        }));
        expect(error).toBeDefined();
        expect(error).toHaveLength(1);
        expect(error[0]).toBe('Line 22 column 18: Invalid value type "Participants": use "int" for integers, "decimal()" for decimals, "nvarchar/varchar" for characters/strings, "datetime" for date time, "bit" for bit.');
        expect(dataEntry).toEqual({});
    });
});

describe('FieldCuratorClass', () => {
    // should stop uploading when error occurs
    function BulkInsert() {
        this._insertArray = [];
        this._executeCalled = []; // array of length of _insertArray when execute() is called
        this.insert = (object) => { this._insertArray.push(object); };
        this.execute = () => new Promise<void>((resolve) => {
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
        expect(mongoStub._bulkinsert._insertArray[0].fieldId).toBe(1);
        expect(mongoStub._bulkinsert._insertArray[0].database).toBe('IDEAFAST');
        expect(mongoStub._bulkinsert._insertArray[0].tableName).toBe('Participants');
        expect(mongoStub._bulkinsert._insertArray[0].tableId).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].sequentialOrder).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].questionNumber).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].fieldName).toBe('SubjectID');
        expect(mongoStub._bulkinsert._insertArray[0].label).toBe('Subject ID');
        expect(mongoStub._bulkinsert._insertArray[0].labelDe).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].labelNl).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].labelIt).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].labelEs).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].labelPl).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].labelF).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].eligibleAnswer).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].ineligibleAnswer).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].validation).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].dataType).toBe(enumValueType.STRING);
        expect(mongoStub._bulkinsert._insertArray[0].controlType).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].systemGenerated).toBe(false);
        expect(mongoStub._bulkinsert._insertArray[0].valueList).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].length).toBe(9);
        expect(mongoStub._bulkinsert._insertArray[0].displayFormat).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].nullable).toBe(true);
        expect(mongoStub._bulkinsert._insertArray[0].required).toBe(false);
        expect(mongoStub._bulkinsert._insertArray[0].mandatory).toBe(true);
        expect(mongoStub._bulkinsert._insertArray[0].collectIf).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].notMapped).toBe(false);
        expect(mongoStub._bulkinsert._insertArray[0].defaultValue).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].regEx).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].regExErrorMsg).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].showOnIndexView).toBe(false);
        expect(mongoStub._bulkinsert._insertArray[0].comments).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].jobId).toBe('mockJobId');
        expect(mongoStub._bulkinsert._insertArray[0].deleted).toBe(null);
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
        expect(mongoStub._bulkinsert._insertArray).toHaveLength(1226);
        expect(mongoStub._bulkinsert._executeCalled).toEqual([1000, 1226]);
        expect(mongoStub._bulkinsert._insertArray[0].id).toBeDefined();
        expect(typeof mongoStub._bulkinsert._insertArray[0].id).toBe('string');
        expect(mongoStub._bulkinsert._insertArray[0].fieldId).toBe(1);
        expect(mongoStub._bulkinsert._insertArray[0].database).toBe('IDEAFAST');
        expect(mongoStub._bulkinsert._insertArray[0].tableName).toBe('Participants');
        expect(mongoStub._bulkinsert._insertArray[0].tableId).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].sequentialOrder).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].questionNumber).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].fieldName).toBe('SubjectID');
        expect(mongoStub._bulkinsert._insertArray[0].label).toBe('Subject ID');
        expect(mongoStub._bulkinsert._insertArray[0].labelDe).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].labelNl).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].labelIt).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].labelEs).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].labelPl).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].labelF).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].eligibleAnswer).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].ineligibleAnswer).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].validation).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].dataType).toBe(enumValueType.STRING);
        expect(mongoStub._bulkinsert._insertArray[0].controlType).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].systemGenerated).toBe(false);
        expect(mongoStub._bulkinsert._insertArray[0].valueList).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].length).toBe(9);
        expect(mongoStub._bulkinsert._insertArray[0].displayFormat).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].nullable).toBe(true);
        expect(mongoStub._bulkinsert._insertArray[0].required).toBe(false);
        expect(mongoStub._bulkinsert._insertArray[0].mandatory).toBe(true);
        expect(mongoStub._bulkinsert._insertArray[0].collectIf).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].notMapped).toBe(false);
        expect(mongoStub._bulkinsert._insertArray[0].defaultValue).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].regEx).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].regExErrorMsg).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].showOnIndexView).toBe(false);
        expect(mongoStub._bulkinsert._insertArray[0].comments).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].jobId).toBe('mockJobId');
        expect(mongoStub._bulkinsert._insertArray[0].deleted).toBe(null);
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
        expect(mongoStub._bulkinsert._insertArray).toHaveLength(1226);
        expect(mongoStub._bulkinsert._executeCalled).toEqual([1000]);
        expect(mongoStub._bulkinsert._insertArray[0].id).toBeDefined();
        expect(typeof mongoStub._bulkinsert._insertArray[0].id).toBe('string');
        expect(mongoStub._bulkinsert._insertArray[0].fieldId).toBe(1);
        expect(mongoStub._bulkinsert._insertArray[0].database).toBe('IDEAFAST');
        expect(mongoStub._bulkinsert._insertArray[0].tableName).toBe('Participants');
        expect(mongoStub._bulkinsert._insertArray[0].tableId).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].sequentialOrder).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].questionNumber).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].fieldName).toBe('SubjectID');
        expect(mongoStub._bulkinsert._insertArray[0].label).toBe('Subject ID');
        expect(mongoStub._bulkinsert._insertArray[0].labelDe).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].labelNl).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].labelIt).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].labelEs).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].labelPl).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].labelF).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].eligibleAnswer).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].ineligibleAnswer).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].validation).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].dataType).toBe(enumValueType.STRING);
        expect(mongoStub._bulkinsert._insertArray[0].controlType).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].systemGenerated).toBe(false);
        expect(mongoStub._bulkinsert._insertArray[0].valueList).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].length).toBe(9);
        expect(mongoStub._bulkinsert._insertArray[0].displayFormat).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].nullable).toBe(true);
        expect(mongoStub._bulkinsert._insertArray[0].required).toBe(false);
        expect(mongoStub._bulkinsert._insertArray[0].mandatory).toBe(true);
        expect(mongoStub._bulkinsert._insertArray[0].collectIf).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].notMapped).toBe(false);
        expect(mongoStub._bulkinsert._insertArray[0].defaultValue).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].regEx).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].regExErrorMsg).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].showOnIndexView).toBe(false);
        expect(mongoStub._bulkinsert._insertArray[0].comments).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].jobId).toBe('mockJobId');
        expect(mongoStub._bulkinsert._insertArray[0].deleted).toBe(null);
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
        expect(mongoStub._bulkinsert._insertArray).toHaveLength(1226);
        expect(mongoStub._bulkinsert._executeCalled).toEqual([1000]);
        expect(mongoStub._bulkinsert._insertArray[0].id).toBeDefined();
        expect(typeof mongoStub._bulkinsert._insertArray[0].id).toBe('string');
        expect(mongoStub._bulkinsert._insertArray[0].fieldId).toBe(1);
        expect(mongoStub._bulkinsert._insertArray[0].database).toBe('IDEAFAST');
        expect(mongoStub._bulkinsert._insertArray[0].tableName).toBe('Participants');
        expect(mongoStub._bulkinsert._insertArray[0].tableId).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].sequentialOrder).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].questionNumber).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].fieldName).toBe('SubjectID');
        expect(mongoStub._bulkinsert._insertArray[0].label).toBe('Subject ID');
        expect(mongoStub._bulkinsert._insertArray[0].labelDe).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].labelNl).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].labelIt).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].labelEs).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].labelPl).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].labelF).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].eligibleAnswer).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].ineligibleAnswer).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].validation).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].dataType).toBe(enumValueType.STRING);
        expect(mongoStub._bulkinsert._insertArray[0].controlType).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].systemGenerated).toBe(false);
        expect(mongoStub._bulkinsert._insertArray[0].valueList).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].length).toBe(9);
        expect(mongoStub._bulkinsert._insertArray[0].displayFormat).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].nullable).toBe(true);
        expect(mongoStub._bulkinsert._insertArray[0].required).toBe(false);
        expect(mongoStub._bulkinsert._insertArray[0].mandatory).toBe(true);
        expect(mongoStub._bulkinsert._insertArray[0].collectIf).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].notMapped).toBe(false);
        expect(mongoStub._bulkinsert._insertArray[0].defaultValue).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].regEx).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].regExErrorMsg).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].showOnIndexView).toBe(false);
        expect(mongoStub._bulkinsert._insertArray[0].comments).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].jobId).toBe('mockJobId');
        expect(mongoStub._bulkinsert._insertArray[0].deleted).toBe(null);
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
        expect(errors).toEqual(['Line 24: Uneven field Number; expected 33 fields but got 31.']);
        expect(mongoStub._bulkinsert._insertArray).toHaveLength(22);
        expect(mongoStub._bulkinsert._executeCalled).toEqual([]);
        expect(mongoStub._bulkinsert._insertArray[0].id).toBeDefined();
        expect(typeof mongoStub._bulkinsert._insertArray[0].id).toBe('string');
        expect(mongoStub._bulkinsert._insertArray[0].fieldId).toBe(1);
        expect(mongoStub._bulkinsert._insertArray[0].database).toBe('IDEAFAST');
        expect(mongoStub._bulkinsert._insertArray[0].tableName).toBe('Participants');
        expect(mongoStub._bulkinsert._insertArray[0].tableId).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].sequentialOrder).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].questionNumber).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].fieldName).toBe('SubjectID');
        expect(mongoStub._bulkinsert._insertArray[0].label).toBe('Subject ID');
        expect(mongoStub._bulkinsert._insertArray[0].labelDe).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].labelNl).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].labelIt).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].labelEs).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].labelPl).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].labelF).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].eligibleAnswer).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].ineligibleAnswer).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].validation).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].dataType).toBe(enumValueType.STRING);
        expect(mongoStub._bulkinsert._insertArray[0].controlType).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].systemGenerated).toBe(false);
        expect(mongoStub._bulkinsert._insertArray[0].valueList).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].length).toBe(9);
        expect(mongoStub._bulkinsert._insertArray[0].displayFormat).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].nullable).toBe(true);
        expect(mongoStub._bulkinsert._insertArray[0].required).toBe(false);
        expect(mongoStub._bulkinsert._insertArray[0].mandatory).toBe(true);
        expect(mongoStub._bulkinsert._insertArray[0].collectIf).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].notMapped).toBe(false);
        expect(mongoStub._bulkinsert._insertArray[0].defaultValue).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].regEx).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].regExErrorMsg).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].showOnIndexView).toBe(false);
        expect(mongoStub._bulkinsert._insertArray[0].comments).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].jobId).toBe('mockJobId');
        expect(mongoStub._bulkinsert._insertArray[0].deleted).toBe(null);
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
        expect(errors).toEqual(['Line 1121: Uneven field Number; expected 33 fields but got 32.']);
        expect(mongoStub._bulkinsert._insertArray).toHaveLength(1119);
        expect(mongoStub._bulkinsert._executeCalled).toEqual([1000]);
        expect(mongoStub._bulkinsert._insertArray[0].id).toBeDefined();
        expect(typeof mongoStub._bulkinsert._insertArray[0].id).toBe('string');
        expect(mongoStub._bulkinsert._insertArray[0].fieldId).toBe(1);
        expect(mongoStub._bulkinsert._insertArray[0].database).toBe('IDEAFAST');
        expect(mongoStub._bulkinsert._insertArray[0].tableName).toBe('Participants');
        expect(mongoStub._bulkinsert._insertArray[0].tableId).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].sequentialOrder).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].questionNumber).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].fieldName).toBe('SubjectID');
        expect(mongoStub._bulkinsert._insertArray[0].label).toBe('Subject ID');
        expect(mongoStub._bulkinsert._insertArray[0].labelDe).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].labelNl).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].labelIt).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].labelEs).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].labelPl).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].labelF).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].eligibleAnswer).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].ineligibleAnswer).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].validation).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].dataType).toBe(enumValueType.STRING);
        expect(mongoStub._bulkinsert._insertArray[0].controlType).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].systemGenerated).toBe(false);
        expect(mongoStub._bulkinsert._insertArray[0].valueList).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].length).toBe(9);
        expect(mongoStub._bulkinsert._insertArray[0].displayFormat).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].nullable).toBe(true);
        expect(mongoStub._bulkinsert._insertArray[0].required).toBe(false);
        expect(mongoStub._bulkinsert._insertArray[0].mandatory).toBe(true);
        expect(mongoStub._bulkinsert._insertArray[0].collectIf).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].notMapped).toBe(false);
        expect(mongoStub._bulkinsert._insertArray[0].defaultValue).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].regEx).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].regExErrorMsg).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].showOnIndexView).toBe(false);
        expect(mongoStub._bulkinsert._insertArray[0].comments).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].jobId).toBe('mockJobId');
        expect(mongoStub._bulkinsert._insertArray[0].deleted).toBe(null);
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
            'Line 10 column 7: Field Name cannot be empty.',
            'Line 69: Uneven field Number; expected 33 fields but got 32.',
            'Line 331 column 18: Invalid value type "Participants": use "int" for integers, "decimal()" for decimals, "nvarchar/varchar" for characters/strings, "datetime" for date time, "bit" for bit.',
            'Line 919 column 1: Cannot parse field ID as number.',
            'Data Error: There is duplicate field id.'
        ]);
        expect(mongoStub._bulkinsert._insertArray).toHaveLength(8);
        expect(mongoStub._bulkinsert._executeCalled).toEqual([]);
    }, 10000);
});
