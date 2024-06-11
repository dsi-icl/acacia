import { LogPlugin } from '@itmat-broker/itmat-cores';
import { db } from '../database/database';

export const logPluginInstance = new LogPlugin(db);