import { Server } from './server/server';
import { Router } from './server/router';
import { Database } from './database/database';
import { OpenStackSwiftObjectStore } from 'itmat-utils';
import config from '../config/config.json';

const db = new Database(config.database);
const objStore = new OpenStackSwiftObjectStore(config.swift);
const server = new Server(config, db, objStore);

server.connectToBackEnd().then(() => {
    const router = new Router();
    server.start(router.getApp());
});