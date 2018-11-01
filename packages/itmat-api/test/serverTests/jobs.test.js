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
    test('create a new job but no body', () =>
        admin.post('/jobs')
            .then(res => {
                expect(res.status).toBe(400);
                expect(res.body).toEqual({ error: true, message: 'A body object with key(s) \'jobType\' are expected. Please check API doc.' });
                return true;
            })
    );

    test('create a new job but with not supported job type (should fail)', () =>
        admin.post('/jobs')
            .send({ jobType: 'ACCIO_MILLION_DOLLARS' })
            .then(res => {
                expect(res.status).toBe(400);
                expect(res.body).toEqual({ error: true, message: 'Invalid value for key \'jobType\'. Valid value(s): UKB_CSV_UPLOAD,UKB_IMAGE_UPLOAD' });
                return true;
            })
    );

    test('create a new job as admin', () =>
        admin.post('/jobs')
            .send({ jobType: 'UKB_CSV_UPLOAD' })
            .then(res => {
                expect(res.status).toBe(200);
                expect(res.body).toHaveProperty('id');
                expect(res.body).toHaveProperty('created');
                jobId = res.body.id;
                delete res.body.id;
                delete res.body.created;
                expect(res.body).toEqual({
                    type: 'UPLOAD',
                    files: ['phenotype.csv'],
                    jobType: 'UKB_CSV_UPLOAD',
                    requester: 'admin',
                    filesReceived: [],
                    numberOfFilesToTransfer: 1,
                    numberOfTransferredFiles: 0,
                    status: 'WAITING FOR FILE FROM CLIENT',
                    carrier: 'hardcoded CARIER URL',
                    error: null
                });
                return true;
            })
    );

    test('cancel job but without body (should fail)', () =>
        admin.delete('/jobs')
            .then(res => {
                expect(res.status).toBe(400);
                expect(res.body).toEqual({ error: true, message: 'A body object with key(s) \'id\' are expected. Please check API doc.' });
                return true;
            })
    );


    test('cancel job but with a jobId that doesnt exist (shoudl fail)', () =>
        admin.delete('/jobs')
            .send({ id: 'fdsaf231412342sdfasfsaf' })
            .then(res => {
                expect(res.status).toBe(404);
                expect(res.body).toEqual({ error: true, message: 'job not found' });
                return true;
            })
    );

    test('cancel job ', () =>
        admin.delete('/jobs')
            .send({ id: jobId })
            .then(res => {
                expect(res.status).toBe(200);
                expect(res.body).toEqual({ message: `Job with id ${jobId} has been cancelled.` });
                return true;
            })
    );
});