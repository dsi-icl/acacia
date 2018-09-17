import { UKBCuratorServer } from './server/server';
import config from './config/config.json';

const server = new UKBCuratorServer(config);

server.start();