import { db } from '../database/database';
import { FileDownloadController } from '@itmat-broker/itmat-cores';
import { objStore } from '../objStore/objStore';


export const fileDownloadControllerInstance = new FileDownloadController(db, objStore);