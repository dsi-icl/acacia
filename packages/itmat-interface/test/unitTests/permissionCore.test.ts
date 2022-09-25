import { v4 as uuid } from 'uuid';
import { Db, MongoClient } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { setupDatabase } from '@itmat-broker/itmat-setup';
import { db } from '../../src/database/database';
import config from '../../config/config.sample.json';
import { permissionCore } from '../../src/graphql/core/permissionCore';
import { permissions, task_required_permissions, IUser, IRole } from '@itmat-broker/itmat-types';

let mongodb: MongoMemoryServer;
let mongoConnection: MongoClient;
let mongoClient: Db;

afterAll(async () => {
    await db.closeConnection();
    await mongoConnection?.close();
    await mongodb.stop();
});

beforeAll(async () => { // eslint-disable-line no-undef
    /* Creating a in-memory MongoDB instance for testing */
    const dbName = uuid();
    mongodb = await MongoMemoryServer.create({ instance: { dbName } });
    const connectionString = mongodb.getUri();
    await setupDatabase(connectionString, dbName);

    /* Wiring up the backend server */
    config.database.mongo_url = connectionString;
    config.database.database = dbName;
    await db.connect(config.database, MongoClient.connect as any);

    /* Connect mongo client (for test setup later / retrieve info later) */
    mongoConnection = await MongoClient.connect(connectionString);
    mongoClient = mongoConnection.db(dbName);
});

describe('PERMISSION CORE CLASS', () => {
    describe('Check userHasTheNeccessaryPermission()', () => {
        let user: { id: any; };
        let newUsers: any[];
        beforeAll(async () => {
            /* setup: create new users to be tested on */
            newUsers = [
                {
                    username: 'new_user_1',
                    type: 'STANDARD',
                    firstname: 'Freal_name_1',
                    lastname: 'Lreal_name_1',
                    password: 'fake_password',
                    otpSecret: 'H6BNKKO27DPLCATGEJAZNWQV4LWOTMRA',
                    email: 'new1@example.com',
                    description: 'I am a new user.',
                    emailNotificationsActivated: true,
                    organisation: 'organisation_system',
                    deleted: null,
                    id: 'new_user_id_1'
                },
                {
                    username: 'new_user_2',
                    type: 'STANDARD',
                    firstname: 'Freal_name_2',
                    lastname: 'Lreal_name_2',
                    password: 'fake_password',
                    otpSecret: 'H6BNKKO27DPLCATGEJAZNWQV4LWOTMRA',
                    email: 'new2@example.com',
                    description: 'I am a new user.',
                    emailNotificationsActivated: true,
                    organisation: 'organisation_system',
                    deleted: null,
                    id: 'new_user_id_2'
                },
                {
                    username: 'new_user_3',
                    type: 'STANDARD',
                    firstname: 'Freal_name_3',
                    lastname: 'Lreal_name_3',
                    password: 'fake_password',
                    otpSecret: 'H6BNKKO27DPLCATGEJAZNWQV4LWOTMRA',
                    email: 'new3@example.com',
                    description: 'I am a new user.',
                    emailNotificationsActivated: true,
                    organisation: 'organisation_system',
                    deleted: null,
                    id: 'new_user_id_3'
                },
                {
                    username: 'new_user_4',
                    type: 'STANDARD',
                    firstname: 'Freal_name_4',
                    lastname: 'Lreal_name_4',
                    password: 'fake_password',
                    otpSecret: 'H6BNKKO27DPLCATGEJAZNWQV4LWOTMRA',
                    email: 'new4@example.com',
                    description: 'I am a new user.',
                    emailNotificationsActivated: true,
                    organisation: 'organisation_system',
                    deleted: null,
                    id: 'new_user_id_4'
                },
                {
                    username: 'new_user_5',
                    type: 'STANDARD',
                    firstname: 'Freal_name_5',
                    lastname: 'Lreal_name_5',
                    password: 'fake_password',
                    otpSecret: 'H6BNKKO27DPLCATGEJAZNWQV4LWOTMRA',
                    email: 'new5@example.com',
                    description: 'I am a new user.',
                    emailNotificationsActivated: true,
                    organisation: 'organisation_system',
                    deleted: null,
                    id: 'new_user_id_5'
                }
            ];
            await mongoClient.collection<IUser>(config.database.collections.users_collection).insertMany(newUsers);

            /* setup: first retrieve the generated user id */
            const result = await mongoClient.collection<IUser>(config.database.collections.users_collection).find({}, { projection: { id: 1, username: 1 } }).toArray();
            user = result.filter((e: { username: string; }) => e.username === 'standardUser')[0];

            /* setup: create roles to be tested on */
            await mongoClient.collection<IRole>(config.database.collections.roles_collection).insertMany([
                // study001
                //     role004 (Principle investigator)
                //         |permissions.specific_study.specific_study_data_management,
                //         |permissions.specific_study.specific_study_readonly_access,
                //         |permissions.specific_study.specific_study_role_management,
                //         |permissions.specific_study.specific_study_projects_management
                //         |newUsers[3]
                //     role003 (Data curator)
                //         |permissions.specific_study.specific_study_data_management,
                //         |newUsers[2]
                //     project001
                //         role001 (Project researchers)
                //             |permissions.specific_project.specific_project_readonly_access
                //             |user newUsers[0]
                //     project002
                //         role002 (Project researchers)
                //             |permissions.specific_project.specific_project_readonly_access
                //             |newUsers[1] newUsers[0]
                // study002
                //     project001
                //         role005 (Project Manager)
                //             |permissions.specific_project.specific_project_role_management,
                //             |permissions.specific_project.specific_project_readonly_access
                //             |user newUsers[2]
                {
                    id: 'role001',
                    projectId: 'project001',
                    studyId: 'study001',
                    name: 'Project researchers',
                    permissions: [
                        permissions.specific_project.specific_project_readonly_access
                    ],
                    users: [user.id, newUsers[0].id],
                    deleted: null
                },
                {
                    id: 'role002',
                    projectId: 'project002',
                    studyId: 'study001',
                    name: 'Project researchers',
                    permissions: [
                        permissions.specific_project.specific_project_readonly_access
                    ],
                    users: [newUsers[1].id, newUsers[0].id],
                    deleted: null
                },
                {
                    id: 'role003',
                    projectId: undefined,
                    studyId: 'study001',
                    name: 'Data curator',
                    permissions: [
                        permissions.specific_study.specific_study_data_management
                    ],
                    users: [newUsers[2].id],
                    deleted: null
                },
                {
                    id: 'role004',
                    projectId: undefined,
                    studyId: 'study001',
                    name: 'Principle Investigator',
                    permissions: [
                        permissions.specific_study.specific_study_data_management,
                        permissions.specific_study.specific_study_readonly_access,
                        permissions.specific_study.specific_study_role_management,
                        permissions.specific_study.specific_study_projects_management
                    ],
                    users: [newUsers[3].id],
                    deleted: null
                },
                {
                    id: 'role005',
                    projectId: 'project001',
                    studyId: 'study002',
                    name: 'Project Manager',
                    permissions: [
                        permissions.specific_project.specific_project_role_management,
                        permissions.specific_project.specific_project_readonly_access
                    ],
                    users: [user.id, newUsers[2].id],
                    deleted: null
                }
            ] as any[]);
        });

        async function testAllPermissions(user: IUser, studyId: string, projectId: string | undefined) {
            return Promise.all([
                permissionCore.userHasTheNeccessaryPermission(
                    task_required_permissions.manage_study_roles,
                    user,
                    studyId,
                    projectId
                ),
                permissionCore.userHasTheNeccessaryPermission(
                    task_required_permissions.manage_study_data,
                    user,
                    studyId,
                    projectId
                ),
                permissionCore.userHasTheNeccessaryPermission(
                    task_required_permissions.manage_study_projects,
                    user,
                    studyId,
                    projectId
                ),
                permissionCore.userHasTheNeccessaryPermission(
                    task_required_permissions.access_study_data,
                    user,
                    studyId,
                    projectId
                ),
                permissionCore.userHasTheNeccessaryPermission(
                    task_required_permissions.access_project_data,
                    user,
                    studyId,
                    projectId
                ),
                permissionCore.userHasTheNeccessaryPermission(
                    task_required_permissions.manage_project_roles,
                    user,
                    studyId,
                    projectId
                )
            ]);
        }

        function testUser(user: any) {
            return Promise.all([
                testAllPermissions(user, 'study001', 'project001'),
                testAllPermissions(user, 'study001', 'project002'),
                testAllPermissions(user, 'study001', undefined),
                testAllPermissions(user, 'study002', 'project001'),
                testAllPermissions(user, 'study002', undefined)
            ]);
        }

        test('User belonging to two studies', async () => {
            const result = await testUser(user);
            expect(result).toEqual([
                [false, false, false, false, true, false],
                [false, false, false, false, false, false],
                [false, false, false, false, false, false],
                [false, false, false, false, true, true],
                [false, false, false, false, false, false]
            ]);
        });

        test('User belonging to two projects', async () => {
            const result = await testUser(newUsers[0]);
            expect(result).toEqual([
                [false, false, false, false, true, false],
                [false, false, false, false, true, false],
                [false, false, false, false, false, false],
                [false, false, false, false, false, false],
                [false, false, false, false, false, false]
            ]);
        });

        test('User belonging to one project', async () => {
            const result = await testUser(newUsers[1]);
            expect(result).toEqual([
                [false, false, false, false, false, false],
                [false, false, false, false, true, false],
                [false, false, false, false, false, false],
                [false, false, false, false, false, false],
                [false, false, false, false, false, false]
            ]);
        });

        test('User belonging to one project and one study', async () => {
            const result = await testUser(newUsers[2]);
            expect(result).toEqual([
                [false, true, false, true, true, false],
                [false, true, false, true, true, false],
                [false, true, false, true, true, false],
                [false, false, false, false, true, true],
                [false, false, false, false, false, false]
            ]);
        });

        test('User belonging to one study (PI)', async () => {
            const result = await testUser(newUsers[3]);
            expect(result).toEqual([
                [true, true, true, true, true, true],
                [true, true, true, true, true, true],
                [true, true, true, true, true, true],
                [false, false, false, false, false, false],
                [false, false, false, false, false, false]
            ]);
        });
    });
});
