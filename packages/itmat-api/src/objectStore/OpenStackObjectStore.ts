import { ObjectStore, IObjectStoreConfig, Models, IOpenSwiftObjectStoreConfig, OpenStackSwiftObjectStore } from 'itmat-utils';
import config from '../../config/config.json';

/* singleton */
export const objectStore = new OpenStackSwiftObjectStore(config.swift);