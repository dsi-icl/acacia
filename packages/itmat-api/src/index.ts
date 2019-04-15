import { Server } from './server/server';
import { Router } from './server/router';
import { db } from './database/database';
import { FileController, UserController } from './RESTControllers';
import { OpenStackSwiftObjectStore } from 'itmat-utils';
import config from '../config/config.json';
import { Query } from 'itmat-utils/dist/models';

const objStore = new OpenStackSwiftObjectStore(config.swift);
const server = new Server(config, db, objStore);

db.connect(config.database)
    .then(() => objStore.connect())
    .then(() => {
        const userController = new UserController(db.collections!.users_collection);
        const fileController = new FileController(db, objStore);
        const router = new Router(db, userController, fileController);
        server.start(router.getApp());
});