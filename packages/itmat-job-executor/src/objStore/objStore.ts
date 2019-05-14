import { OpenStackSwiftObjectStore } from 'itmat-utils';
import config from '../../config/config.json';

export const objStore = new OpenStackSwiftObjectStore(config.swift);

