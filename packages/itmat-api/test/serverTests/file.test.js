'use strict';
const request = require('supertest');
const admin = request.agent(global.app);
const user = request.agent(global.app);
const { connectAdmin, connectUser, disconnectAgent } = require('./loginHelper');

let jobId;


beforeAll(async () => { //eslint-disable-line no-undef
    await connectAdmin(admin);
    // await connectUser(user);
});


// afterAll(() => {
//     mongod.stop();
// });

describe('Server - Jobs API', () => {
    test('Upload file to a job that doesnt exist (should fail)', () =>
        admin.post('/jobs/34823915-234u891jnfsajk231/rfsdfsa.csv/fileUpload')
            .then(res => {
                expect(res.status).toBe(404);
                expect(res.body).toEqual({ error: true, message: 'job not found' });
                return true;
            })
    );

    test('create a new job as admin', () =>
        admin.post('/jobs')
            .send({ jobType: 'UKB_CSV_UPLOAD' })
            .then(res => {
                expect(res.status).toBe(200);
                jobId = res.body.id;
                return true;
            })
    );

    test('Upload file to a job but with wrong file name (should fail)', () =>
        admin.post(`/jobs/${jobId}/rfsdfsa.csv/fileUpload`)
            .attach('file', 'test/testFile.txt')
            .then(res => {
                expect(res.status).toBe(400);
                expect(res.body).toEqual({ error: true, message: 'Invalid value for key \'fileName\'. Valid value(s): phenotype.csv' });
                return true;
            })
    );


    //****************************************************** */
    // test('Upload file to a job but with wrong body (should fail)', () =>
    //     admin.post(`/jobs/${jobId}/phenotype.csv/fileUpload`)
    //         .attach('filess', 'test/testFile.txt')
    //         .then(res => {
    //             expect(res.status).toBe(41);
    //             expect(res.body).toEqual({ error: true, message: 'job not found' });
    //             return true;
    //         })
    // );

    test('Upload file to a job', () =>
        admin.post(`/jobs/${jobId}/phenotype.csv/fileUpload`)
            .attach('file', 'test/testFile.txt')
            .then(res => {
                expect(res.status).toBe(200);
                expect(res.body).toEqual({ message: 'File successfully uploaded.' });
                return true;
            })
    );

    // test('file count is updated', () =>
    //     admin.get(`/jobs/${jobId}`)
    //         .then(res => {
    //             expect(res.status).toBe(200);
    //             expect(res.body.numberOfTransferredFiles).toBe(1);
    //             return true;
    //         })
    // );

});