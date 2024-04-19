/**
 * @with Minio
 */

import { ObjectStore } from '../../src/utils';
import path from 'path';
import fs from 'fs-extra';
import type { Readable } from 'stream';

const ACCESS_KEY = 'minioadmin';
const SECRET_KEY = 'minioadmin';
const HOST = 'localhost';

declare const global: typeof globalThis & {
    hasMinio: boolean;
    minioContainerPort: number;
};

if (global.hasMinio) describe('OBJECT STORE CLASS TESTS', () => {
    let client: ObjectStore;
    beforeEach(async () => {
        client = new ObjectStore();
        await client.connect({
            host: HOST,
            port: global.minioContainerPort,
            accessKey: ACCESS_KEY,
            secretKey: SECRET_KEY,
            useSSL: false
        });
    });

    test('Connect to store', async () => {
        const objstore = new ObjectStore();
        const connectresult = await objstore.connect({
            host: HOST,
            port: global.minioContainerPort,
            accessKey: ACCESS_KEY,
            secretKey: SECRET_KEY,
            bucketRegion: 'test-bucket',
            useSSL: false
        });
        expect(connectresult).toEqual([]);
    });

    test('Upload file where studyId bucket doesnt exist yet', async () => {
        const uploadResult = await client.uploadFile(
            fs.createReadStream(path.join(__dirname, '../files/fakefile.txt')),
            'fakeStudy1',
            '1459034jf9jdklsafj2ojffo-qj-s0fjds0fa'
        );
        expect(typeof uploadResult).toBe('string');
    });

    test('Upload file where studyId bucket already exists', async () => {
        await client.uploadFile(
            fs.createReadStream(path.join(__dirname, '../files/fakefile.txt')),
            'fakeStudy2',
            '145safj2ojffo-qj-sdfsad0fjds0fafdsj21'
        );

        const uploadResult = await client.uploadFile(
            fs.createReadStream(path.join(__dirname, '../files/fakefile.txt')),
            'fakeStudy2',
            '145safd0445klfsaj-sdfsad0fjds0fafdsj21'
        );
        expect(typeof uploadResult).toBe('string');
    });

    test('Upload file whose name is duplicated', async () => {
        await client.uploadFile(
            fs.createReadStream(path.join(__dirname, '../files/fakefile2.txt')),
            'fakeStudy3',
            'jkfljsdkfjij042rjio2-fi0-ds9a'
        );

        let uploadResult;
        let error: any;
        try {
            uploadResult = await client.uploadFile(
                fs.createReadStream(path.join(__dirname, '../files/fakefile.txt')),
                'fakeStudy3',
                'jkfljsdkfjij042rjio2-fi0-ds9a'
            );
        } catch (e) {
            error = e;
        }
        expect(uploadResult).toBeUndefined();
        expect(error.toString()).toBe('Error: File "jkfljsdkfjij042rjio2-fi0-ds9a" of study "fakeStudy3" already exists.');
    });

    test('Download file', async () => {
        await client.uploadFile(
            fs.createReadStream(path.join(__dirname, '../files/fakefile2.txt')),
            'fakeStudy3',
            'sdfsad0fjds0fafdsj21'
        );
        const downloadResult = await client.downloadFile(
            'fakeStudy3',
            'sdfsad0fjds0fafdsj21'
        );

        const streamToString = async (inputStream: Readable) => {
            return new Promise((resolve, reject) => {
                let string = '';
                inputStream
                    .on('data', data => { string = `${string}${data.toString()}`; })
                    .on('end', () => { resolve(string); })
                    .on('error', reject);
            });
        };
        expect(await streamToString(downloadResult)).toBe('just a fake file 2.');
    });
}); else test(`${__filename.split(/[\\/]/).pop()} skipped because it requires Minio on Docker`, () => {
    expect(true).toBe(true);
});
