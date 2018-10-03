import { APIServer } from './server/server';
import config from './config/config.json';

export const server = new APIServer(config);

server.start();