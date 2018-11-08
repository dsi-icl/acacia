import { APIServer } from './server/server';
import { Router } from './server/router';
import { APIDatabase } from './database/database';
import { OpenStackSwiftObjectStore } from 'itmat-utils';
import config from '../config/config.json';

const db = new APIDatabase(config.database);
const router = new Router(db.getDB());
const objStore = new OpenStackSwiftObjectStore(config.swift);

export const server = new APIServer(config, db, objStore, router.getApp());

server.start();