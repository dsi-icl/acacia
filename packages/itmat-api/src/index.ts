import { Server } from './server/server';
import { Router } from './server/router';
import { Database } from './database/database';
import { FileController, UserController, StudyController, QueryController } from './RESTControllers';
import { OpenStackSwiftObjectStore } from 'itmat-utils';
import config from '../config/config.json';
import { Query } from 'itmat-utils/dist/models';

const db = new Database(config.database);
const objStore = new OpenStackSwiftObjectStore(config.swift);
const server = new Server(config, db, objStore);

server.connectToBackEnd().then(() => {
    const userController = new UserController(db.users_collection!);
    const fileController = new FileController(db, objStore);
    const studyController = new StudyController(db.studies_collection!);
    const queryController = new QueryController(db.queries_collection!);
    const router = new Router(db, userController, fileController, studyController, queryController);
    server.start(router.getApp());
});