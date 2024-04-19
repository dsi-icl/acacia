import fs from 'fs';
import path from 'path';
import { IJobEntryForFieldCuration, IJobEntry, enumValueType } from '@itmat-broker/itmat-types';
import { processFieldRow, FieldCurator } from '../../src/curation/FieldCurator';
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
        fieldTreeId: 'mockFieldTreeId',
        codes: {}
    };

    it('processFieldRow function correctly parse data row', () => {
        const { error, dataEntry } = processFieldRow(stub<any>({
            ...templateParams, row: [
                '564', 'IDEAFAST', 'Participants', '', '', '', 'SubjectID', 'Subject ID', '', '', '', '', '', '', '', '', '', 'nvarchar', '', 'False', '', '9', '', 'True', 'False', 'True', '', 'False', '', '', '', 'False', ''
            ]
        }));
        expect(error).toBeUndefined();
        expect(dataEntry.id).toBeDefined();
        expect(typeof dataEntry.id).toBe('string');
        expect(dataEntry.fieldName).toBe('SubjectID');
        expect(dataEntry.dataType).toBe(enumValueType.STRING);
        expect(dataEntry.possibleValues).toEqual([]);
        expect(dataEntry.unit).toBe('');
        expect(dataEntry.comments).toBe('');
        expect(dataEntry.dateDeleted).toBe(null);
        expect(typeof dataEntry.dateAdded).toBe('string');
    });

    it('processFieldRow function detects necessary fields that are empty', () => {
        const { error, dataEntry } = processFieldRow(stub<any>({
            ...templateParams, row: [
                '', 'IDEAFAST', 'Participants', '', '', '', '', 'Subject ID', '', '', '', '', '', '', '', '', '', 'nvarchar', '', 'False', '', '9', '', 'True', 'False', 'True', '', 'False', '', '', '', 'False', ''
            ]
        }));
        expect(error).toBeDefined();
        if (!error)
            return;
        expect(error).toHaveLength(2);
        expect(error[0]).toBe('Line 22 column 1: FieldID cannot be empty.');
        expect(error[1]).toBe('Line 22 column 7: Field Name cannot be empty.');
        expect(dataEntry).toEqual({});
    });

    it('processFieldRow function detects uneven fields', () => {
        const { error, dataEntry } = processFieldRow(stub<any>({
            ...templateParams, row: [
                '564', 'IDEAFAST', 'Participants', '', '', '', 'SubjectID', 'Subject ID', '', '', '', '', '', '', '', '', '', 'nvarchar', '', 'False', '', '9', '', 'True', 'False', 'True', 'False', '', '', '', 'False'
            ]
        }));
        expect(error).toBeDefined();
        if (!error)
            return;
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
                '564A', 'IDEAFAST', 'Participants', '', '', '', 'SubjectID', 'Subject ID', '', '', '', '', '', '', '', '', '', 'nvarchar', '', 'False', '', '9A', '', 'True', 'False', 'True', '', 'False', '', '', '', 'False', ''
            ]
        }));
        expect(error).toBeDefined();
        if (!error)
            return;
        expect(error).toHaveLength(2);
        expect(error[0]).toBe('Line 22 column 1: Cannot parse field ID as number.');
        expect(error[1]).toBe('Line 22 column 22: Cannot parse length of characters as number.');
        expect(dataEntry).toEqual({});
    });

    it('processFieldRow function catches invalid value type', () => {
        const { error, dataEntry } = processFieldRow(stub<any>({
            ...templateParams, row: [
                '564', 'IDEAFAST', 'Participants', '', '', '', 'SubjectID', 'Subject ID', '', '', '', '', '', '', '', '', '', 'str', '', 'False', '', '9', '', 'True', 'False', 'True', '', 'False', '', '', '', 'False', ''
            ]
        }));
        expect(error).toBeDefined();
        if (!error)
            return;
        expect(error).toHaveLength(1);
        expect(error[0]).toBe('Line 22 column 18: Invalid value type "Participants": use "int" for integers, "decimal()" for decimals, "nvarchar/varchar" for characters/strings, "datetime" for date time, "bit" for bit.');
        expect(dataEntry).toEqual({});
    });
});

describe('FieldCuratorClass', () => {
    // should stop uploading when error occurs
    function BulkInsert(this: any) {
        this._insertArray = [];
        this._executeCalled = []; // array of length of _insertArray when execute() is called
        this.insert = (object: any) => { this._insertArray.push(object); };
        this.execute = async () => new Promise<void>((resolve) => {
            setTimeout(() => {
                this._executeCalled.push(this._insertArray.length);
                resolve();
            }, 10);
        });
    }

    function MongoStub(this: any) {
        this._bulkinsert = new (BulkInsert as any)();
        this.initializeUnorderedBulkOp = () => this._bulkinsert;
    }

    it('test mongostub', async () => {
        const bulkinsert = (new (MongoStub as any)()).initializeUnorderedBulkOp();
        bulkinsert.insert({});
        bulkinsert.insert({});
        return bulkinsert.execute().then(() => {
            bulkinsert.insert({});
            return bulkinsert.execute();
        }).then(() => {
            expect(bulkinsert._insertArray).toEqual([{}, {}, {}]);
            expect(bulkinsert._executeCalled).toEqual([2, 3]);
        });
    });

    it('fieldcurator uploads csv file < 1000 fields okay', async () => {
        const readStream = fs.createReadStream(path.join(__dirname, '../testFiles/FieldCurator.tsv'));
        const mongoStub = new (MongoStub as any)();
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
            {}
        );
        const errors = await fieldcurator.processIncomingStreamAndUploadToMongo();
        expect(errors).toEqual([]);
        expect(mongoStub._bulkinsert._insertArray).toHaveLength(26);
        expect(mongoStub._bulkinsert._executeCalled).toEqual([26]);
        expect(mongoStub._bulkinsert._insertArray[0].id).toBeDefined();
        expect(typeof mongoStub._bulkinsert._insertArray[0].id).toBe('string');
        expect(mongoStub._bulkinsert._insertArray[0].fieldName).toBe('SubjectID');
        expect(mongoStub._bulkinsert._insertArray[0].dataType).toBe(enumValueType.STRING);
        expect(mongoStub._bulkinsert._insertArray[0].possibleValues).toEqual([]);
        expect(mongoStub._bulkinsert._insertArray[0].unit).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].comments).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].dateDeleted).toBe(null);
        expect(typeof mongoStub._bulkinsert._insertArray[0].dateAdded).toBe('string');
    });

    it('fieldcurator uploads csv file > 1000 fields okay', async () => {
        const readStream = fs.createReadStream(path.join(__dirname, '../testFiles/FieldCurator_1000.tsv'));
        const mongoStub = new (MongoStub as any)();
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
            {}
        );
        const errors = await fieldcurator.processIncomingStreamAndUploadToMongo();
        expect(errors).toEqual([]);
        expect(mongoStub._bulkinsert._insertArray).toHaveLength(1226);
        expect(mongoStub._bulkinsert._executeCalled).toEqual([1000, 1226]);
        expect(mongoStub._bulkinsert._insertArray[0].id).toBeDefined();
        expect(typeof mongoStub._bulkinsert._insertArray[0].id).toBe('string');
        expect(mongoStub._bulkinsert._insertArray[0].fieldName).toBe('SubjectID');
        expect(mongoStub._bulkinsert._insertArray[0].dataType).toBe(enumValueType.STRING);
        expect(mongoStub._bulkinsert._insertArray[0].possibleValues).toEqual([]);
        expect(mongoStub._bulkinsert._insertArray[0].unit).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].comments).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].dateDeleted).toBe(null);
        expect(typeof mongoStub._bulkinsert._insertArray[0].dateAdded).toBe('string');
    });

    it('fieldcurator catches duplicate fieldId before first watermark', async () => {
        const readStream = fs.createReadStream(path.join(__dirname, '../testFiles/FieldCurator_error1.tsv'));
        const mongoStub = new (MongoStub as any)();
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
            {}
        );
        const errors = await fieldcurator.processIncomingStreamAndUploadToMongo();
        expect(errors).toEqual(['Data Error: There is duplicate field id.']);
        expect(mongoStub._bulkinsert._insertArray).toHaveLength(1226);
        expect(mongoStub._bulkinsert._executeCalled).toEqual([1000]);
        expect(mongoStub._bulkinsert._insertArray[0].id).toBeDefined();
        expect(typeof mongoStub._bulkinsert._insertArray[0].id).toBe('string');
        expect(mongoStub._bulkinsert._insertArray[0].fieldName).toBe('SubjectID');
        expect(mongoStub._bulkinsert._insertArray[0].dataType).toBe(enumValueType.STRING);
        expect(mongoStub._bulkinsert._insertArray[0].possibleValues).toEqual([]);
        expect(mongoStub._bulkinsert._insertArray[0].unit).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].comments).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].dateDeleted).toBe(null);
        expect(typeof mongoStub._bulkinsert._insertArray[0].dateAdded).toBe('string');
    });

    it('fieldcurator catches duplicate fieldId after first watermark', async () => {
        const readStream = fs.createReadStream(path.join(__dirname, '../testFiles/FieldCurator_error2.tsv'));
        const mongoStub = new (MongoStub as any)();
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
            {}
        );
        const errors = await fieldcurator.processIncomingStreamAndUploadToMongo();
        expect(errors).toEqual(['Data Error: There is duplicate field id.']);
        expect(mongoStub._bulkinsert._insertArray).toHaveLength(1226);
        expect(mongoStub._bulkinsert._executeCalled).toEqual([1000]);
        expect(mongoStub._bulkinsert._insertArray[0].id).toBeDefined();
        expect(typeof mongoStub._bulkinsert._insertArray[0].id).toBe('string');
        expect(mongoStub._bulkinsert._insertArray[0].fieldName).toBe('SubjectID');
        expect(mongoStub._bulkinsert._insertArray[0].dataType).toBe(enumValueType.STRING);
        expect(mongoStub._bulkinsert._insertArray[0].possibleValues).toEqual([]);
        expect(mongoStub._bulkinsert._insertArray[0].unit).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].comments).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].dateDeleted).toBe(null);
        expect(typeof mongoStub._bulkinsert._insertArray[0].dateAdded).toBe('string');
    });

    it('fieldcurator catches uneven field before watermark', async () => {
        const readStream = fs.createReadStream(path.join(__dirname, '../testFiles/FieldCurator_error3.tsv'));
        const mongoStub = new (MongoStub as any)();
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
            {}
        );
        const errors = await fieldcurator.processIncomingStreamAndUploadToMongo();
        expect(errors).toEqual(['Line 24: Uneven field Number; expected 33 fields but got 31.']);
        expect(mongoStub._bulkinsert._insertArray).toHaveLength(22);
        expect(mongoStub._bulkinsert._executeCalled).toEqual([]);
        expect(mongoStub._bulkinsert._insertArray[0].id).toBeDefined();
        expect(typeof mongoStub._bulkinsert._insertArray[0].id).toBe('string');
        expect(mongoStub._bulkinsert._insertArray[0].fieldName).toBe('SubjectID');
        expect(mongoStub._bulkinsert._insertArray[0].dataType).toBe(enumValueType.STRING);
        expect(mongoStub._bulkinsert._insertArray[0].possibleValues).toEqual([]);
        expect(mongoStub._bulkinsert._insertArray[0].unit).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].comments).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].dateDeleted).toBe(null);
        expect(typeof mongoStub._bulkinsert._insertArray[0].dateAdded).toBe('string');
    });

    it('fieldcurator catches uneven field after watermark', async () => {
        const readStream = fs.createReadStream(path.join(__dirname, '../testFiles/FieldCurator_error4.tsv'));
        const mongoStub = new (MongoStub as any)();
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
            {}
        );
        const errors = await fieldcurator.processIncomingStreamAndUploadToMongo();
        expect(errors).toEqual(['Line 1121: Uneven field Number; expected 33 fields but got 32.']);
        expect(mongoStub._bulkinsert._insertArray).toHaveLength(1119);
        expect(mongoStub._bulkinsert._executeCalled).toEqual([1000]);
        expect(mongoStub._bulkinsert._insertArray[0].id).toBeDefined();
        expect(typeof mongoStub._bulkinsert._insertArray[0].id).toBe('string');
        expect(mongoStub._bulkinsert._insertArray[0].fieldName).toBe('SubjectID');
        expect(mongoStub._bulkinsert._insertArray[0].dataType).toBe(enumValueType.STRING);
        expect(mongoStub._bulkinsert._insertArray[0].possibleValues).toEqual([]);
        expect(mongoStub._bulkinsert._insertArray[0].unit).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].comments).toBe('');
        expect(mongoStub._bulkinsert._insertArray[0].dateDeleted).toBe(null);
        expect(typeof mongoStub._bulkinsert._insertArray[0].dateAdded).toBe('string');
    });

    it('fieldcurator catches mixed errors', async () => {
        const readStream = fs.createReadStream(path.join(__dirname, '../testFiles/FieldCurator_error5.tsv'));
        const mongoStub = new (MongoStub as any)();
        const jobEntry = stub<IJobEntry>({  // subset of the IJobEntry interface
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
            {}
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
    });
});
