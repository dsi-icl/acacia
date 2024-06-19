/**
 * @with Minio
 */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import { MongoMemoryServer } from 'mongodb-memory-server';
import { db } from '../../src/database/database';
import { Express } from 'express';
import { objStore } from '../../src/objStore/objStore';
import request from 'supertest';
import { connectAdmin, connectUser } from './_loginHelper';
import { Router } from '../../src/server/router';
import { Db, MongoClient } from 'mongodb';
import { setupDatabase } from '@itmat-broker/itmat-setup';
import config from '../../config/config.sample.json';
import { v4 as uuid } from 'uuid';
import { enumUserTypes, enumDriveNodeTypes, enumCoreErrors } from '@itmat-broker/itmat-types';
import { encodeQueryParams } from './helper';
import { errorCodes } from '@itmat-broker/itmat-cores';
import path from 'path';

if (global.hasMinio) {
    let app: Express;
    let mongodb: MongoMemoryServer;
    let admin: request.SuperTest<request.Test>;
    let user: request.SuperTest<request.Test>;
    let mongoConnection: MongoClient;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    let mongoClient: Db;
    let adminProfile;
    let userProfile;

    afterAll(async () => {
        await db.closeConnection();
        await mongoConnection?.close();
        await mongodb.stop();

        /* claer all mocks */
        jest.clearAllMocks();
    });

    beforeAll(async () => { // eslint-disable-line no-undef
        /* Creating a in-memory MongoDB instance for testing */
        const dbName = uuid();
        mongodb = await MongoMemoryServer.create({ instance: { dbName } });
        const connectionString = mongodb.getUri();
        await setupDatabase(connectionString, dbName);
        /* Wiring up the backend server */
        config.objectStore.port = (global as any).minioContainerPort;
        config.database.mongo_url = connectionString;
        config.database.database = dbName;
        await db.connect(config.database, MongoClient);
        await objStore.connect(config.objectStore);
        const router = new Router(config);
        await router.init();
        /* Connect mongo client (for test setup later / retrieve info later) */
        mongoConnection = await MongoClient.connect(connectionString);
        mongoClient = mongoConnection.db(dbName);

        /* Connecting clients for testing later */
        app = router.getApp();
        admin = request.agent(app);
        user = request.agent(app);
        await connectAdmin(admin);
        await connectUser(user);

        // add the root node for each user
        const users = await db.collections.users_collection.find({}).toArray();
        adminProfile = users.filter(el => el.type === enumUserTypes.ADMIN)[0];
        userProfile = users.filter(el => el.type === enumUserTypes.STANDARD)[0];
    });

    beforeEach(async () => {
        const users = await db.collections.users_collection.find({}).toArray();
        for (const user of users) {
            const uid = uuid();
            await db.collections.drives_collection.insertOne({
                id: uid,
                managerId: user.id,
                path: [uid],
                restricted: true,
                name: 'My Drive',
                description: null,
                fileId: null,
                type: enumDriveNodeTypes.FOLDER,
                parent: null,
                children: [],
                sharedUsers: [],
                life: {
                    createdTime: 0,
                    createdUser: enumUserTypes.SYSTEM,
                    deletedTime: null,
                    deletedUser: null
                },
                metadata: {}
            });
        }
    });

    afterEach(async () => {
        await db.collections.drives_collection.deleteMany({});
    });

    describe('tRPC drive APIs', () => {
        test('Get drives of a user', async () => {
            const paramteres = {
                userId: userProfile.id
            };
            const response = await user.get('/trpc/drive.getDrives?input=' + encodeQueryParams(paramteres))
                .query({

                });
            expect(response.status).toBe(200);
            expect(response.body.errors).toBeUndefined();
            expect(Object.keys(response.body.result.data)).toHaveLength(1);
            const key = Object.keys(response.body.result.data)[0];
            expect(response.body.result.data[key]).toHaveLength(1);
        });
        test('Get drives of a user (with shared files)', async () => {
            const adminDrive = await db.collections.drives_collection.findOne({ managerId: adminProfile.id });
            const childDriveId = uuid();
            await db.collections.drives_collection.insertOne({
                id: childDriveId,
                managerId: adminProfile.id,
                path: [uuid()],
                restricted: true,
                name: 'Shared Drive',
                description: null,
                fileId: null,
                type: enumDriveNodeTypes.FOLDER,
                parent: adminDrive,
                children: [],
                sharedUsers: [{ iid: userProfile.id, read: true, write: false, delete: false }],
                life: {
                    createdTime: 0,
                    createdUser: enumUserTypes.SYSTEM,
                    deletedTime: null,
                    deletedUser: null
                },
                metadata: {}
            });
            await db.collections.drives_collection.findOneAndUpdate({ id: adminDrive.id }, {
                $push: {
                    children: childDriveId.id, sharedUsers: {
                        iid: userProfile.id,
                        read: true,
                        write: false,
                        delete: false
                    }
                }
            });
            const paramteres = {
                userId: userProfile.id
            };
            const response = await user.get('/trpc/drive.getDrives?input=' + encodeQueryParams(paramteres))
                .query({

                });
            expect(response.status).toBe(200);
            expect(response.body.errors).toBeUndefined();
            expect(Object.keys(response.body.result.data)).toHaveLength(2);
            expect(response.body.result.data[userProfile.id]).toHaveLength(1);
            expect(response.body.result.data[adminProfile.id]).toHaveLength(2);
        });
        test('Get drives of a user (Invalid root id)', async () => {
            const paramteres = {
                rootId: 'random'
            };
            const response = await user.get('/trpc/drive.getDrives?input=' + encodeQueryParams(paramteres))
                .query({

                });
            expect(response.status).toBe(400);
            expect(response.body.error.message).toBe('Root drive does not exist.');
        });
        test('Get drives of a user (non-owned drives)', async () => {
            const drive = await db.collections.drives_collection.findOne({ managerId: adminProfile.id });
            const paramteres = {
                rootId: drive.id
            };
            const response = await user.get('/trpc/drive.getDrives?input=' + encodeQueryParams(paramteres))
                .query({

                });
            expect(response.status).toBe(400);
            expect(response.body.error.message).toBe('No permission to get drives.');
        });
        test('Create a Drive Folder', async () => {
            const root = await db.collections.drives_collection.findOne({ managerId: userProfile.id });
            const response = await user.post('/trpc/drive.createDriveFolder')
                .send({
                    folderName: 'Test',
                    parentId: root.id
                });
            expect(response.status).toBe(200);
            expect(response.body.result.data.name).toBe('Test');
            const drives = await db.collections.drives_collection.find({ managerId: userProfile.id }).toArray();
            expect(drives[1].parent).toBe(drives[0].id);
        });
        test('Create a Drive Folder (in default root)', async () => {
            const response = await user.post('/trpc/drive.createDriveFolder')
                .send({
                    folderName: 'Test',
                    parentId: null
                });
            expect(response.status).toBe(200);
            expect(response.body.result.data.name).toBe('Test');
            const drives = await db.collections.drives_collection.find({ managerId: userProfile.id }).toArray();
            expect(drives[1].parent).toBe(drives[0].id);
        });
        test('Create a Drive Folder (non-owned parent)', async () => {
            const root = (await db.collections.drives_collection.find({ managerId: adminProfile.id }).toArray())[0];
            const response = await user.post('/trpc/drive.createDriveFolder')
                .send({
                    folderName: 'Test',
                    parentId: root.id
                });
            expect(response.status).toBe(400);
            expect(response.body.error.message).toBe('No permission to create folder.');
        });
        test('Create a Drive Folder (non-existing parent)', async () => {
            const response = await user.post('/trpc/drive.createDriveFolder')
                .send({
                    folderName: 'Test',
                    parentId: 'random'
                });
            expect(response.status).toBe(400);
            expect(response.body.error.message).toBe('No permission to create folder.');
        });
        test('Create a Drive Folder (folder already exist)', async () => {
            await user.post('/trpc/drive.createDriveFolder')
                .send({
                    folderName: 'Test',
                    parentId: null
                });
            const response = await user.post('/trpc/drive.createDriveFolder')
                .send({
                    folderName: 'Test',
                    parentId: null
                });
            expect(response.status).toBe(400);
            expect(response.body.error.message).toBe('Folder already exists.');
        });
        test('Create a Drive Folder (Parent is not a folder)', async () => {
            const childDriveId = uuid();
            await db.collections.drives_collection.insertOne({
                id: childDriveId,
                managerId: userProfile.id,
                path: [uuid()],
                restricted: true,
                name: 'Shared File',
                description: null,
                fileId: null,
                type: enumDriveNodeTypes.FILE,
                parent: null,
                children: [],
                sharedUsers: [],
                life: {
                    createdTime: 0,
                    createdUser: enumUserTypes.SYSTEM,
                    deletedTime: null,
                    deletedUser: null
                },
                metadata: {}
            });
            const userRootDrive = await db.collections.drives_collection.findOne({ managerId: userProfile.id });
            await db.collections.drives_collection.findOneAndUpdate({ id: userRootDrive.id }, { $push: { children: childDriveId.id } });
            const response = await user.post('/trpc/drive.createDriveFolder')
                .send({
                    folderName: 'Test',
                    parentId: childDriveId
                });
            expect(response.status).toBe(400);
            expect(response.body.error.message).toBe('Parent is not a folder.');
        });
        test('Create a Drive Folder (under another users account with permission)', async () => {
            await db.collections.drives_collection.findOneAndUpdate({ managerId: adminProfile.id }, {
                $push: { sharedUsers: { iid: userProfile.id, read: true, write: true, delete: false } }
            });
            const adminDrive = await db.collections.drives_collection.findOne({ managerId: adminProfile.id });
            const response = await user.post('/trpc/drive.createDriveFolder')
                .send({
                    folderName: 'Test',
                    parentId: adminDrive?.id
                });
            expect(response.status).toBe(200);
            expect(response.body.errors).toBeUndefined();
            expect(response.body.result.data.name).toBe('Test');
            const newDrive = await db.collections.drives_collection.findOne({ name: 'Test' });
            expect(newDrive).toBeDefined();
            expect(newDrive.parent).toBe(adminDrive.id);
            expect(newDrive?.name).toBe('Test');
        });
        test('Create a Drive File', async () => {
            const root = (await db.collections.drives_collection.find({ managerId: userProfile.id }).toArray())[0];
            const filePath = path.join(__dirname, '../filesForTests/I7N3G6G-MMM7N3G6G-20200704-20200721.txt');
            const request = user.post('/trpc/drive.createDriveFile')
                .attach('file', filePath)
                .field('parentId', root.id)
                .field('description', '');
            const response = await request;
            expect(response.status).toBe(200);
            expect(response.body.result.data.name).toBe('I7N3G6G-MMM7N3G6G-20200704-20200721.txt');
            const drives = await db.collections.drives_collection.find({ managerId: userProfile.id }).toArray();
            expect(drives).toHaveLength(2);
            expect(response.body.result.data.parent).toBe(drives[0].id);

        });
        test('Create a Drive File （in default root）', async () => {
            const filePath = path.join(__dirname, '../filesForTests/I7N3G6G-MMM7N3G6G-20200704-20200721.txt');
            const request = user.post('/trpc/drive.createDriveFile')
                .attach('file', filePath)
                .field('parentId', '')
                .field('description', '');
            const response = await request;

            expect(response.status).toBe(200);
            expect(response.body.result.data.name).toBe('I7N3G6G-MMM7N3G6G-20200704-20200721.txt');
            const drives = await db.collections.drives_collection.find({ managerId: userProfile.id }).toArray();
            expect(drives).toHaveLength(2);
            expect(response.body.result.data.parent).toBe(drives[0].id);
        });
        test('Create a Drive File （for unpermitted parent）', async () => {
            const filePath = path.join(__dirname, '../filesForTests/I7N3G6G-MMM7N3G6G-20200704-20200721.txt');
            const request = user.post('/trpc/drive.createDriveFile')
                .attach('file', filePath)
                .field('parentId', 'random')
                .field('description', '');
            const response = await request;
            expect(response.status).toBe(400);
            expect(response.body.error.message).toBe(enumCoreErrors.NO_PERMISSION_ERROR);
            const drives = await db.collections.drives_collection.find({ managerId: userProfile.id }).toArray();
            expect(drives).toHaveLength(1);
        });
        test('Create a Drive File （not owned drive）', async () => {
            const adminDrive = await db.collections.drives_collection.findOne({ managerId: adminProfile.id });
            const filePath = path.join(__dirname, '../filesForTests/I7N3G6G-MMM7N3G6G-20200704-20200721.txt');
            const request = user.post('/trpc/drive.createDriveFile')
                .attach('file', filePath)
                .field('parentId', adminDrive?.id)
                .field('description', '');
            const response = await request;
            expect(response.status).toBe(400);
            expect(response.body.error.message).toBe(enumCoreErrors.NO_PERMISSION_ERROR);
            const drives = await db.collections.drives_collection.find({ managerId: userProfile.id }).toArray();
            expect(drives).toHaveLength(1);
        });
        test('Create a Drive File shared drive）', async () => {
            const adminDrive = await db.collections.drives_collection.findOne({ managerId: adminProfile.id });
            const filePath = path.join(__dirname, '../filesForTests/I7N3G6G-MMM7N3G6G-20200704-20200721.txt');
            const request = user.post('/trpc/drive.createDriveFile')
                .attach('file', filePath)
                .field('parentId', adminDrive?.id)
                .field('description', '');
            const response = await request;
            expect(response.status).toBe(400);
            expect(response.body.error.message).toBe(enumCoreErrors.NO_PERMISSION_ERROR);
            const drives = await db.collections.drives_collection.find({ managerId: userProfile.id }).toArray();
            expect(drives).toHaveLength(1);
        });
        test('Create a Drive File （file already exist）', async () => {
            const rootDrive = await db.collections.drives_collection.findOne({ managerId: userProfile.id, parent: null });
            function createDriveFile(filePath, parentId) {
                const request = parentId ? user.post('/trpc/drive.createDriveFile')
                    .attach('file', filePath)
                    .field('parentId', parentId) :
                    user.post('/trpc/drive.createDriveFile')
                        .attach('file', filePath);
                return request;
            }
            const filePath = path.join(__dirname, '../filesForTests/I7N3G6G-MMM7N3G6G-20200704-20200721.txt');
            await createDriveFile(filePath, rootDrive.id);
            const response = await createDriveFile(filePath, rootDrive.id);
            expect(response.status).toBe(400);
            expect(response.body.error.message).toBe('File already exists.');
        });
        test('Create a Drive File （to a file parent）', async () => {
            const rootDrive = await db.collections.drives_collection.findOne({ managerId: userProfile.id, parent: null });
            function createDriveFile(filePath, parentId) {
                const request = parentId ? user.post('/trpc/drive.createDriveFile')
                    .attach('file', filePath)
                    .field('parentId', parentId) :
                    user.post('/trpc/drive.createDriveFile')
                        .attach('file', filePath);
                return request;
            }
            const filePath = path.join(__dirname, '../filesForTests/I7N3G6G-MMM7N3G6G-20200704-20200721.txt');
            await createDriveFile(filePath, rootDrive.id);
            const fileDrive = await db.collections.drives_collection.findOne({ managerId: userProfile.id, parent: rootDrive.id });
            const response = await createDriveFile(filePath, fileDrive.id);
            expect(response.status).toBe(400);
            expect(response.body.error.message).toBe('Parent is not a folder.');
        });
        test('Delete a drive node', async () => {
            const response1 = await user.post('/trpc/drive.createDriveFolder')
                .send({
                    folderName: 'Test',
                    parentId: null
                });
            const drives = await db.collections.drives_collection.find({ 'managerId': userProfile.id, 'life.deletedTime': null }).toArray();
            expect(drives).toHaveLength(2);
            const response2 = await user.post('/trpc/drive.deleteDrive')
                .send({
                    driveId: response1.body.result.data.id
                });
            expect(response2.status).toBe(200);
            expect(response2.body.result.data.id).toBe(response1.body.result.data.id);
            const drives2 = await db.collections.drives_collection.find({ 'managerId': userProfile.id, 'life.deletedTime': null }).toArray();
            expect(drives2).toHaveLength(1);
        });
        test('Delete a drive node (with recursive children)', async () => {
            const response1 = await user.post('/trpc/drive.createDriveFolder')
                .send({
                    folderName: 'Test',
                    parentId: null
                });
            const drives = await db.collections.drives_collection.find({ 'managerId': userProfile.id, 'life.deletedTime': null }).toArray();
            expect(drives).toHaveLength(2);
            await user.post('/trpc/drive.createDriveFolder')
                .send({
                    folderName: 'Test2',
                    parentId: response1.body.result.data.id
                });
            const drives2 = await db.collections.drives_collection.find({ 'managerId': userProfile.id, 'life.deletedTime': null }).toArray();
            expect(drives2).toHaveLength(3);
            const response3 = await user.post('/trpc/drive.deleteDrive')
                .send({
                    driveId: response1.body.result.data.id
                });
            expect(response3.status).toBe(200);
            expect(response3.body.result.data.id).toBe(response1.body.result.data.id);
            const drives3 = await db.collections.drives_collection.find({ 'managerId': userProfile.id, 'life.deletedTime': null }).toArray();
            expect(drives3).toHaveLength(1);
        });
        test('Delete a drive node (node does not exist)', async () => {
            await user.post('/trpc/drive.createDriveFolder')
                .send({
                    folderName: 'Test',
                    parentId: null
                });
            const response = await user.post('/trpc/drive.deleteDrive')
                .send({
                    driveId: 'random'
                });
            expect(response.status).toBe(400);
            expect(response.body.error.message).toBe('Drive does not exist.');
            const drives = await db.collections.drives_collection.find({ 'managerId': userProfile.id, 'life.deletedTime': null }).toArray();
            expect(drives).toHaveLength(2);
        });
        test('Share folders/files to another user via email', async () => {
            const response1 = await user.post('/trpc/drive.createDriveFolder')
                .send({
                    folderName: 'Test',
                    parentId: null
                });
            const response2 = await user.post('/trpc/drive.shareDriveToUserViaEmail')
                .send({
                    userEmails: [adminProfile.email],
                    driveId: response1.body.result.data.parent,
                    permissions: {
                        read: true,
                        write: false,
                        delete: false
                    }
                });
            expect(response2.status).toBe(200);
            expect(response2.body.result.data).toEqual([response1.body.result.data.parent, response1.body.result.data.id]);
            const drives = await db.collections.drives_collection.find({ managerId: userProfile.id }).toArray();
            expect(drives[0].sharedUsers).toContainEqual({ iid: adminProfile.id, read: true, write: false, delete: false });
            expect(drives[1].sharedUsers).toContainEqual({ iid: adminProfile.id, read: true, write: false, delete: false });
            const paramteres: any = {
                userId: adminProfile.id
            };
            const response3 = await user.get('/trpc/drive.getDrives?input=' + encodeQueryParams(paramteres))
                .query({});
            expect(response3.status).toBe(200);
            expect(response3.body.result.data[userProfile.id]).toBeDefined();
            expect(response3.body.result.data[userProfile.id]).toHaveLength(2);
        });
        test('Share folders/files to another user via email (Email does not exist)', async () => {
            const response1 = await user.post('/trpc/drive.createDriveFolder')
                .send({
                    folderName: 'Test',
                    parentId: null
                });
            const response2 = await user.post('/trpc/drive.shareDriveToUserViaEmail')
                .send({
                    userEmails: ['random'],
                    driveId: response1.body.result.data.parent,
                    permissions: {
                        read: true,
                        write: false,
                        delete: false
                    }
                });
            expect(response2.status).toBe(200);
            const drive = await db.collections.drives_collection.findOne({ id: response1.body.result.data.id });
            expect(drive.sharedUsers).toHaveLength(0);
        });
        test('Edit a drive', async () => {
            const response1 = await user.post('/trpc/drive.createDriveFolder')
                .send({
                    folderName: 'Test',
                    parentId: null
                });
            const response2 = await user.post('/trpc/drive.createDriveFolder')
                .send({
                    folderName: 'Test',
                    parentId: response1.body.result.data.id
                });
            const response3 = await user.post('/trpc/drive.editDrive')
                .send({
                    driveId: response1.body.result.data.id,
                    sharedUsers: [{
                        iid: adminProfile.id,
                        read: true,
                        write: false,
                        delete: false
                    }]
                });
            expect(response3.status).toBe(200);
            expect(response3.body.result.data.driveIds).toEqual([response1.body.result.data.id, response2.body.result.data.id]);
            const drives = await db.collections.drives_collection.find({ id: { $in: [response1.body.result.data.id, response2.body.result.data.id] } }).toArray();
            expect(drives[0].sharedUsers[0]).toEqual({ iid: adminProfile.id, read: true, write: false, delete: false });
            expect(drives[1].sharedUsers[0]).toEqual({ iid: adminProfile.id, read: true, write: false, delete: false });
        });
        test('Edit a drive (drive does not exist)', async () => {
            const response1 = await user.post('/trpc/drive.createDriveFolder')
                .send({
                    folderName: 'Test',
                    parentId: null
                });
            await user.post('/trpc/drive.createDriveFolder')
                .send({
                    folderName: 'Test',
                    parentId: response1.body.result.data.id
                });
            const response3 = await user.post('/trpc/drive.editDrive')
                .send({
                    driveId: 'random',
                    sharedUsers: [{
                        iid: adminProfile.id,
                        read: true,
                        write: false,
                        delete: false
                    }]
                });
            expect(response3.status).toBe(400);
            expect(response3.body.error.message).toBe(enumCoreErrors.NO_PERMISSION_ERROR);
        });
        test('Edit a drive (not owned drive)', async () => {
            const response1 = await admin.post('/trpc/drive.createDriveFolder')
                .send({
                    folderName: 'Test',
                    parentId: null
                });
            await user.post('/trpc/drive.createDriveFolder')
                .send({
                    folderName: 'Test',
                    parentId: response1.body.result.data.id
                });
            const response3 = await user.post('/trpc/drive.editDrive')
                .send({
                    driveId: response1.body.result.data.id,
                    sharedUsers: [{
                        iid: adminProfile.id,
                        read: true,
                        write: false,
                        delete: false
                    }]
                });
            expect(response3.status).toBe(400);
            expect(response3.body.error.message).toBe(errorCodes.NO_PERMISSION_ERROR);
        });
        test('Edit a drive (manager does not exist)', async () => {
            const response1 = await user.post('/trpc/drive.createDriveFolder')
                .send({
                    folderName: 'Test',
                    parentId: null
                });
            await user.post('/trpc/drive.createDriveFolder')
                .send({
                    folderName: 'Test',
                    parentId: response1.body.result.data.id
                });
            const response3 = await user.post('/trpc/drive.editDrive')
                .send({
                    driveId: response1.body.result.data.id,
                    managerId: 'random'
                });
            expect(response3.status).toBe(400);
            expect(response3.body.error.message).toBe('Manager does not exist.');
        });
        test('Edit a drive (name already exists)', async () => {
            const response1 = await user.post('/trpc/drive.createDriveFolder')
                .send({
                    folderName: 'Test',
                    parentId: null
                });
            await user.post('/trpc/drive.createDriveFolder')
                .send({
                    folderName: 'Test',
                    parentId: response1.body.result.data.id
                });
            const response3 = await user.post('/trpc/drive.editDrive')
                .send({
                    driveId: response1.body.result.data.id,
                    name: 'Test'
                });
            expect(response3.status).toBe(400);
            expect(response3.body.error.message).toBe('Name already exists.');
        });
        test('Edit a drive (parent does not exist)', async () => {
            const response1 = await user.post('/trpc/drive.createDriveFolder')
                .send({
                    folderName: 'Test',
                    parentId: null
                });
            await user.post('/trpc/drive.createDriveFolder')
                .send({
                    folderName: 'Test',
                    parentId: response1.body.result.data.id
                });
            const response3 = await user.post('/trpc/drive.editDrive')
                .send({
                    driveId: response1.body.result.data.id,
                    parentId: 'random'
                });
            expect(response3.status).toBe(400);
            expect(response3.body.error.message).toBe('Parent does not exist.');
        });
        test('Edit a drive (children does not exist)', async () => {
            const response1 = await user.post('/trpc/drive.createDriveFolder')
                .send({
                    folderName: 'Test',
                    parentId: null
                });
            await user.post('/trpc/drive.createDriveFolder')
                .send({
                    folderName: 'Test',
                    parentId: response1.body.result.data.id
                });
            const response3 = await user.post('/trpc/drive.editDrive')
                .send({
                    driveId: response1.body.result.data.id,
                    children: ['random']
                });
            expect(response3.status).toBe(400);
            expect(response3.body.error.message).toBe('Children do not exist.');
        });
        test('Edit a drive (shared users do not exist)', async () => {
            const response1 = await user.post('/trpc/drive.createDriveFolder')
                .send({
                    folderName: 'Test',
                    parentId: null
                });
            await user.post('/trpc/drive.createDriveFolder')
                .send({
                    folderName: 'Test',
                    parentId: response1.body.result.data.id
                });
            const response3 = await user.post('/trpc/drive.editDrive')
                .send({
                    driveId: response1.body.result.data.id,
                    sharedUsers: [{
                        iid: 'random',
                        read: true,
                        write: false,
                        delete: false
                    }]
                });
            expect(response3.status).toBe(400);
            expect(response3.body.error.message).toBe('Shared users do not exist.');
        });
        test('Edit a drive (empty update)', async () => {
            const response1 = await user.post('/trpc/drive.createDriveFolder')
                .send({
                    folderName: 'Test',
                    parentId: null
                });
            await user.post('/trpc/drive.createDriveFolder')
                .send({
                    folderName: 'Test',
                    parentId: response1.body.result.data.id
                });
            const response3 = await user.post('/trpc/drive.editDrive')
                .send({
                    driveId: response1.body.result.data.id
                });
            expect(response3.status).toBe(400);
            expect(response3.body.error.message).toBe('You have to edit at lease one property.');
        });
        test('Copy a drive node (self)', async () => {
            function createDriveFile(filePath, parentId) {
                const request = parentId ? user.post('/trpc/drive.createDriveFile')
                    .attach('file', filePath)
                    .field('parentId', parentId) :
                    user.post('/trpc/drive.createDriveFile')
                        .attach('file', filePath);
                return request;
            }
            const response1 = await user.post('/trpc/drive.createDriveFolder')
                .send({
                    folderName: 'Test',
                    parentId: null
                });
            const filePath = path.join(__dirname, '../filesForTests/I7N3G6G-MMM7N3G6G-20200704-20200721.txt');
            await createDriveFile(filePath, response1.body.result.data.id);
            const reponse2 = await user.post('/trpc/drive.createDriveFolder')
                .send({
                    folderName: 'Test2',
                    parentId: null
                });
            const response = await user.post('/trpc/drive.copyDrive')
                .send({
                    driveId: response1.body.result.data.id,
                    targetParentId: reponse2.body.result.data.id
                });
            expect(response.status).toBe(200);
            expect(response.body.result.data.successful).toBe(true);
            const drives = await db.collections.drives_collection.find({ managerId: userProfile.id }).toArray();
            expect(drives).toHaveLength(6);
            expect(drives.filter(el => el.name === 'Test')).toHaveLength(2);
            expect(drives.filter(el => el.type === enumDriveNodeTypes.FILE)).toHaveLength(2);
            expect(drives.filter(el => el.type === enumDriveNodeTypes.FOLDER)).toHaveLength(4); // including one root
        });
        test('Copy a drive node (unauthorised permission)', async () => {
            function createDriveFile(filePath, parentId) {
                const request = parentId ? admin.post('/trpc/drive.createDriveFile')
                    .attach('file', filePath)
                    .field('parentId', parentId) :
                    admin.post('/trpc/drive.createDriveFile')
                        .attach('file', filePath);
                return request;
            }
            const response1 = await admin.post('/trpc/drive.createDriveFolder')
                .send({
                    folderName: 'Test',
                    parentId: null
                });
            const filePath = path.join(__dirname, '../filesForTests/I7N3G6G-MMM7N3G6G-20200704-20200721.txt');
            await createDriveFile(filePath, response1.body.result.data.id);
            const userRootDrive = await db.collections.drives_collection.findOne({ managerId: userProfile.id });
            const response = await user.post('/trpc/drive.copyDrive')
                .send({
                    driveId: response1.body.result.data.id,
                    targetParentId: userRootDrive?.id
                });
            expect(response.status).toBe(400);
            expect(response.body.error.message).toBe(enumCoreErrors.NO_PERMISSION_ERROR);
        });
        test('Copy a drive node (target parent does not exist)', async () => {
            function createDriveFile(filePath, parentId) {
                const request = parentId ? user.post('/trpc/drive.createDriveFile')
                    .attach('file', filePath)
                    .field('parentId', parentId) :
                    user.post('/trpc/drive.createDriveFile')
                        .attach('file', filePath);
                return request;
            }
            const response1 = await user.post('/trpc/drive.createDriveFolder')
                .send({
                    folderName: 'Test',
                    parentId: null
                });
            const filePath = path.join(__dirname, '../filesForTests/I7N3G6G-MMM7N3G6G-20200704-20200721.txt');
            await createDriveFile(filePath, response1.body.result.data.id);
            const response = await user.post('/trpc/drive.copyDrive')
                .send({
                    driveId: response1.body.result.data.id,
                    targetParentId: 'random'
                });
            expect(response.status).toBe(400);
            expect(response.body.error.message).toBe(enumCoreErrors.NO_PERMISSION_ERROR);
        });
        test('Copy a drive node (drive does not exist)', async () => {
            const userRootDrive = await db.collections.drives_collection.findOne({ managerId: userProfile.id });
            const response = await user.post('/trpc/drive.copyDrive')
                .send({
                    driveId: 'random',
                    targetParentId: userRootDrive?.id
                });
            expect(response.status).toBe(400);
            expect(response.body.error.message).toBe(enumCoreErrors.NO_PERMISSION_ERROR);
        });
        test('Copy drive from other users', async () => {
            const adminDrive = await db.collections.drives_collection.findOne({ managerId: adminProfile.id });
            const response = await admin.post('/trpc/drive.createDriveFolder')
                .send({
                    folderName: 'Test',
                    parentId: adminDrive.id
                });
            await db.collections.drives_collection.findOneAndUpdate({ id: response.body.result.data.id }, {
                $push: {
                    sharedUsers: {
                        iid: userProfile.id,
                        read: true,
                        write: false,
                        delete: false
                    }
                }
            });
            const userRootDrive = await db.collections.drives_collection.findOne({ managerId: userProfile.id });
            const response2 = await user.post('/trpc/drive.copyDrive')
                .send({
                    driveId: response.body.result.data.id,
                    targetParentId: userRootDrive.id
                });
            expect(response2.status).toBe(200);
            expect(response2.body.result.data.successful).toBe(true);
            const drives = await db.collections.drives_collection.find({ managerId: userProfile.id }).toArray();
            expect(drives).toHaveLength(2);
        });
        test('Copy drive from other users (no permission)', async () => {
            const adminDrive = await db.collections.drives_collection.findOne({ managerId: adminProfile.id });
            const response = await admin.post('/trpc/drive.createDriveFolder')
                .send({
                    folderName: 'Test',
                    parentId: adminDrive.id
                });
            const userRootDrive = await db.collections.drives_collection.findOne({ managerId: userProfile.id });
            const response2 = await user.post('/trpc/drive.copyDrive')
                .send({
                    driveId: response.body.result.data.id,
                    targetParentId: userRootDrive.id
                });
            expect(response2.status).toBe(400);
            expect(response2.body.error.message).toBe(enumCoreErrors.NO_PERMISSION_ERROR);
        });
    });
} else {
    test(`${__filename.split(/[\\/]/).pop()} skipped because it requires Minio on Docker`, () => {
        expect(true).toBe(true);
    });
}