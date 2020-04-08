const { ObjectStore } = require('../src/objStore');
const { minioContainerSetup, minioContainerTeardown } = require('../../../test/fixtures/_minioHelper');
const path = require('path');
const fs = require('fs');

const ACCESS_KEY = 'minioadmin';
const SECRET_KEY = 'minioadmin';
const HOST = 'localhost';
let PORT;
let minioContainerName;

afterAll(async () => {
    if (minioContainerName)
        await minioContainerTeardown(minioContainerName)
});

beforeAll(async () => { // eslint-disable-line no-undef
    const containerSetup = await minioContainerSetup().catch(() => {
        test = test.skip;
    });
    if (containerSetup) {
        const [minioContainer, minioPort] = containerSetup;
        minioContainerName = minioContainer;
        PORT = minioPort;
    }
}, 10000);

describe('OBJECT STORE CLASS TESTS', () => {

    if (!minioContainerName) test('Docker is not present', () => {
        expect(true).toBe(true);
    })

    let client;
    if (minioContainerName) beforeEach(async () => {
        console.log('test === test.skip', test === test.skip);
        if (test === test.skip)
            return;
        client = new ObjectStore();
        await client.connect({
            host: HOST,
            port: PORT,
            accessKey: ACCESS_KEY,
            secretKey: SECRET_KEY,
            useSSL: false 
        });
    });

    if (minioContainerName) test('Connect to store', async () => {
        const objstore = new ObjectStore();
        const connectresult = await objstore.connect({
            host: HOST,
            port: PORT,
            accessKey: ACCESS_KEY,
            secretKey: SECRET_KEY,
            useSSL: false
        });
        expect(connectresult).toEqual([]);
    });

    if (minioContainerName) test('Upload file where studyId bucket doesnt exist yet', async () => {
        const uploadResult = await client.uploadFile(
            fs.createReadStream(path.join(__dirname, 'files/fakefile.txt')),
            'fakeStudy1',
            '1459034jf9jdklsafj2ojffo-qj-s0fjds0fa'
        );
        expect(typeof uploadResult).toBe('string');
    });

    if (minioContainerName) test('Upload file where studyId bucket already exists', async () => {
        await client.uploadFile(
            fs.createReadStream(path.join(__dirname, 'files/fakefile.txt')),
            'fakeStudy2',
            '145safj2ojffo-qj-sdfsad0fjds0fafdsj21'
        );

        const uploadResult = await client.uploadFile(
            fs.createReadStream(path.join(__dirname, 'files/fakefile.txt')),
            'fakeStudy2',
            '145safd0445klfsaj-sdfsad0fjds0fafdsj21'
        );
        expect(typeof uploadResult).toBe('string');
    });

    if (minioContainerName) test('Upload file whose name is duplicated', async () => {
        await client.uploadFile(
            fs.createReadStream(path.join(__dirname, 'files/fakefile2.txt')),
            'fakeStudy3',
            'jkfljsdkfjij042rjio2-fi0-ds9a'
        );

        let uploadResult;
        let error;
        try {
            uploadResult = await client.uploadFile(
                fs.createReadStream(path.join(__dirname, 'files/fakefile.txt')),
                'fakeStudy3',
                'jkfljsdkfjij042rjio2-fi0-ds9a'
        );
        } catch (e) {
            error = e;
        }
        expect(uploadResult).toBeUndefined();
        expect(error.toString()).toBe('Error: File "jkfljsdkfjij042rjio2-fi0-ds9a" of study "fakeStudy3" already exists.');
    });

    if (minioContainerName) test('Download file', async () => {
        await client.uploadFile(
            fs.createReadStream(path.join(__dirname, 'files/fakefile2.txt')),
            'fakeStudy3',
            'sdfsad0fjds0fafdsj21'
        );
        const downloadResult = await client.downloadFile(
            'fakeStudy3',
            'sdfsad0fjds0fafdsj21'
        );

        const streamToString = (inputStream) => {
            return new Promise((resolve, reject) => {
                let string = '';
                inputStream
                    .on('data', data => { string = `${string}${data.toString()}`})
                    .on('end', () => { resolve(string); })
                    .on('error', reject)
            });
        };
        expect(await streamToString(downloadResult)).toBe('just a fake file 2.');
    });
});
