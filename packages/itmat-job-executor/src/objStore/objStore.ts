import { ObjectStore } from 'itmat-utils';
import config from '../utils/configManager';

export const objStore = new ObjectStore(config.swift);

