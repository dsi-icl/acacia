const { processDataRow, processHeader } = require('../../src/curation/CSVCurator');

describe('Unit tests for processHeader function', () => {
    it('processHeader function weeds out syntax error', () => {
        const exampleheader = ['eid', '1-3.3', '1-4.3'];
        const { error, parsedHeader } = processHeader(exampleheader);
        expect(parsedHeader.length).toBe(3);
        expect(parsedHeader[0]).toBeNull();
        expect(parsedHeader[1]).toBeNull();
        expect(parsedHeader[2]).toBeNull();
        expect(error).toBeDefined();
        expect(error.length).toBe(2);
        expect(error[0]).toBe("Line 1: '1-3.3' is not a valid header field descriptor.");
        expect(error[1]).toBe("Line 1: '1-4.3' is not a valid header field descriptor.");
    });

    it('processHeader function weeds out duplicates', () => {
        const exampleheader = ['eid', '1@3.3', '1@3.3', '1@2.1', '2@3.2'];
        const { error, parsedHeader } = processHeader(exampleheader);
        expect(parsedHeader.length).toBe(5);
        expect(parsedHeader[0]).toBeNull();
        expect(parsedHeader[1]).toEqual({ fieldId: 1, timepoint: 3, measurement: 3, datatype: 'c' });
        expect(parsedHeader[2]).toEqual({ fieldId: 1, timepoint: 3, measurement: 3, datatype: 'c' });
        expect(parsedHeader[3]).toEqual({ fieldId: 1, timepoint: 2, measurement: 1, datatype: 'c' });
        expect(parsedHeader[4]).toEqual({ fieldId: 2, timepoint: 3, measurement: 2, datatype: 'c' });
        expect(error).toBeDefined();
        expect(error.length).toBe(1);
        expect(error[0]).toBe("Line 1: There is duplicate (field, timepoint, measurement) combination.");
    });

    it('processHeader function, user can annotate data type', () => {
        const exampleheader = ['eid', '1@3.3:i', '1@3.3:c', '1@2.1:b', '2@3.2:c'];
        const { error, parsedHeader } = processHeader(exampleheader);
        expect(parsedHeader.length).toBe(5);
        expect(parsedHeader[0]).toBeNull();
        expect(parsedHeader[1]).toEqual({ fieldId: 1, timepoint: 3, measurement: 3, datatype: 'i' });
        expect(parsedHeader[2]).toEqual({ fieldId: 1, timepoint: 3, measurement: 3, datatype: 'c' });
        expect(parsedHeader[3]).toEqual({ fieldId: 1, timepoint: 2, measurement: 1, datatype: 'b' });
        expect(parsedHeader[4]).toEqual({ fieldId: 2, timepoint: 3, measurement: 2, datatype: 'c' });
        expect(error).toBeDefined();
        expect(error.length).toBe(1);
        expect(error[0]).toBe("Line 1: There is duplicate (field, timepoint, measurement) combination.");
    });

    it('processHeader function weeds out wrong data type', () => {
        const exampleheader = ['eid', '1@3.3:p', '1@2.1:b', '2@3.2:e'];
        const { error, parsedHeader } = processHeader(exampleheader);
        expect(parsedHeader.length).toBe(4);
        expect(parsedHeader[0]).toBeNull();
        expect(parsedHeader[1]).toBeNull();
        expect(parsedHeader[2]).toEqual({ fieldId: 1, timepoint: 2, measurement: 1, datatype: 'b' });
        expect(parsedHeader[3]).toBeNull();
        expect(error).toBeDefined();
        expect(error.length).toBe(2);
        expect(error[0]).toBe("Line 1: '1@3.3:p' is not a valid header field descriptor.");
        expect(error[1]).toBe("Line 1: '2@3.2:e' is not a valid header field descriptor.");
    });

    it('processHeader function correctly parsed header', () => {
        const exampleheader = ['eid', '1@3.3:c', '1@2.1:i', '2@3.2:b'];
        const { error, parsedHeader } = processHeader(exampleheader);
        expect(parsedHeader.length).toBe(4);
        expect(parsedHeader[0]).toBeNull();
        expect(parsedHeader[1]).toEqual({ fieldId: 1, timepoint: 3, measurement: 3, datatype: 'c' });
        expect(parsedHeader[2]).toEqual({ fieldId: 1, timepoint: 2, measurement: 1, datatype: 'i' });
        expect(parsedHeader[3]).toEqual({ fieldId: 2, timepoint: 3, measurement: 2, datatype: 'b' });
        expect(error).toBeUndefined();
    });
});

describe('Unit tests for processDataRow function', () => {
    const templateParams = {
        lineNum: 22,
        row: [],
        parsedHeader: processHeader(['eid', '1@3.3:c', '1@2.1:i', '2@3.2:b', '3@3.1:d']).parsedHeader,
        job: {  // subset of the IJobEntry interface
            id: 'mockJobId',
            studyId: 'mockStudyId',
            data: {
                dataVersion: '0.0.1',
                versionTag: 'testData' 
            }
        },
        versionId: 'mockVersionId'
    };

    it('processDataRow function correctly parse data row', () => {
        const { error, dataEntry } = processDataRow({ ...templateParams, row: ['A001', 'male', '95', 'true', '4.64'] });
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

    it('processDataRow function weeds out datatype mismatch', () => {
        const { error, dataEntry } = processDataRow({ ...templateParams, row: ['A001', 'male', 'female', 'male', '4.64'] });
        expect(error).toBeDefined();
        expect(error).toHaveLength(2);
        expect(error[0]).toBe("Line 22 column 3: Cannot parse 'female' as integer.");
        expect(error[1]).toBe("Line 22 column 4: value for boolean type must be 'true' or 'false'.");
        expect(dataEntry).toEqual({
            m_eid: 'A001',
            m_jobId: 'mockJobId',
            m_study: 'mockStudyId',
            m_versionId: 'mockVersionId',
            1: { 3: { 3: 'male' } },
            3: { 3: { 1: 4.64 } }
        });
    });

    it('processDataRow function weeds out datatype mismatch (2)', () => {
        const { error, dataEntry } = processDataRow({ ...templateParams, row: ['A001', '45', '53', 'false', '5a'] });
        expect(error).toBeDefined();
        expect(error).toHaveLength(1);
        expect(error[0]).toBe("Line 22 column 5: Cannot parse '5a' as decimal.");
        expect(dataEntry).toEqual({
            m_eid: 'A001',
            m_jobId: 'mockJobId',
            m_study: 'mockStudyId',
            m_versionId: 'mockVersionId',
            1: { 2: { 1: 53 }, 3: { 3: '45' } },
            2: { 3: { 2: false } },
        });
    });

    it('processDataRow function deals with missing value by skipping', () => {
        const { error, dataEntry } = processDataRow({ ...templateParams, row: ['A001', '', '', 'false', '5.96'] });
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

    it('processDataRow function deals with missing subject id correctly', () => {
        const { error, dataEntry } = processDataRow({ ...templateParams, row: ['', 'male', '53', 'false', '5.3'] });
        expect(error).toBeDefined();
        expect(error).toHaveLength(1);
        expect(error[0]).toBe("Line 22: No subject id provided.");
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