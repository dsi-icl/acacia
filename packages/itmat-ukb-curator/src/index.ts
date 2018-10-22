import { UKBCuratorServer } from './server/server';
import config from '../config/config.json';

export const server = new UKBCuratorServer(config);

server.start();