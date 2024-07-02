import { v2 as webdav } from 'webdav-server';
import { DMPFileSystem, DMPWebDAVAuthentication, IConfiguration, TRPCDataCore, TRPCDataTransformationCore, TRPCDriveCore, TRPCFileCore, TRPCPermissionCore, TRPCStudyCore } from '@itmat-broker/itmat-cores';
import { objStore } from '../objStore/objStore';
import { db } from '../database/database';
import { TRPCUtilsCore } from 'packages/itmat-cores/src/trpcCore/utilsCore';
import { Logger } from '@itmat-broker/itmat-commons';

class DMPWebDav {
    public async connect(config: IConfiguration) {
        const httpAuthentication = new DMPWebDAVAuthentication(db, 'realem');
        const webServer = new webdav.WebDAVServer({
            port: config.webdavPort,
            httpAuthentication: httpAuthentication as webdav.HTTPAuthentication
        });

        const fileCore = new TRPCFileCore(db, objStore);
        const driveCore = new TRPCDriveCore(db, fileCore, objStore);
        const premissionCore = new TRPCPermissionCore(db);
        const studyCore = new TRPCStudyCore(db, objStore, premissionCore, fileCore);
        const utilsCore = new TRPCUtilsCore();
        const dataTransformatonCore = new TRPCDataTransformationCore(utilsCore);
        const dataCore = new TRPCDataCore(db, fileCore, premissionCore, utilsCore, dataTransformatonCore);

        webServer.setFileSystem('/DMP', new DMPFileSystem(db, fileCore, driveCore, studyCore, dataCore), (success) => {
            webServer.start(() => Logger.log('DMP file system attached: ' + (success ? 'success' : 'failed')));
        });

        Logger.log('Webdav is starting...');
    }
}

export const dmpWebDav = new DMPWebDav();