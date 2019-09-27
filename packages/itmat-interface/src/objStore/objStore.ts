import { OpenStackSwiftObjectStore } from 'itmat-utils';
import config from '../utils/configManager';

export const objStore = new OpenStackSwiftObjectStore(config.swift);