'use strict';

//DOES NOT TEST UPLOADING TO MONGO

const UKBCSVCurator = require('../../dist/src/curation/curationImplementations/implementation1').UKBCSVDataCurator;
const fs = require('fs');

const testFile = 'test/testFile.txt';

let curator;
let fileStream;


beforeAll(async () => {
    fileStream = fs.createReadStream(testFile);
    curator = new UKBCSVCurator('mockJobId', 'fileName', fileStream);
});

afterAll(() => {
    fileStream.close();
});

const exampleHeaderElements = [
    {
        valueType: 'integer',
        totalArrayNumber: 2,
        field: {
            fieldId: 32,
            instance: 2,
            array: 2
        }
    },
    {
        valueType: 'float',
        totalArrayNumber: 2,
        field: {
            fieldId: 32,
            instance: 2,
            array: 2
        }
    },
    {
        valueType: 'float',
        totalArrayNumber: 1,
        field: {
            fieldId: 32,
            instance: 2,
            array: 2
        }
    },
    {
        valueType: 'categorical',
        totalArrayNumber: 1,
        field: {
            fieldId: 32,
            instance: 2,
            array: 2
        }
    },
    {
        coding: { '001': 'Male', '002': 'Female', '3': 'Preferred not to say' },
        valueType: 'categorical',
        totalArrayNumber: 1,
        field: {
            fieldId: 32,
            instance: 2,
            array: 2
        }
    }
];

describe('UKB CSV Curator units', () => {
    test('processValue_helper_testValueType value type is integer, prevalue is integer', async () => {
        const result = await curator.processValue_helper_testValueType(exampleHeaderElements[0], '4');
        expect(result).toBe(4);
    });

    test('processValue_helper_testValueType value type is float, prevalue is float', async () => {
        const result = await curator.processValue_helper_testValueType(exampleHeaderElements[1], '4.3');
        expect(result).toBe(4.3);
    });

    test('processValue_helper_testValueType value type is float, prevalue is string', async () => {
        const result = await curator.processValue_helper_testValueType(exampleHeaderElements[1], 'abc');
        expect(result).toBe('abc');
    });

    test('processValue_helper_testValueType value type is categorical, prevalue is string', async () => {
        const result = await curator.processValue_helper_testValueType(exampleHeaderElements[3], 'abc');
        expect(result).toBe('abc');
    });

    test('processValue_helper_testValueType value type is categorical, prevalue is float', async () => {
        const result = await curator.processValue_helper_testValueType(exampleHeaderElements[3], '1334');
        expect(result).toBe('1334');
    });

    test('parseFieldHeader', () => {
        expect(curator.parseFieldHeader('31-2.3')).toEqual({
            fieldId: 31,
            instance: 2,
            array: 3
        });
    });

    test('processValue; integer, integer', () => {
        expect(curator.processValue(exampleHeaderElements[0], '42')).toEqual(42);
    });

    test('checkFieldIsValid with right field', () => {
        expect(curator.checkFieldIsValid(exampleHeaderElements[3])).toEqual(false);
    });

    test('checkFieldIsValid with wrong field', () => {
        expect(curator.checkFieldIsValid(exampleHeaderElements[2])).toEqual(true);
    });

});