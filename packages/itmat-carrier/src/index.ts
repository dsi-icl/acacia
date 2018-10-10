import { CarrierServer } from './server/server';
import config from './config/config.json';

export const server = new CarrierServer(config);

server.start();