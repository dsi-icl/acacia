import { v2 as webdav } from 'webdav-server';
import { DMPFileSystem, DMPWebDAVAuthentication, IConfiguration, DataCore, DataTransformationCore, DriveCore, FileCore, PermissionCore, StudyCore, UtilsCore } from '@itmat-broker/itmat-cores';
import { objStore } from '../objStore/objStore';
import { db } from '../database/database';
import { Logger } from '@itmat-broker/itmat-commons';

class DMPWebDav {
    public async connect(config: IConfiguration) {
        const httpAuthentication = new DMPWebDAVAuthentication(db, 'realem');
        const webServer = new webdav.WebDAVServer({
            port: config.webdavPort,
            httpAuthentication: httpAuthentication as webdav.HTTPAuthentication
        });

        const fileCore = new FileCore(db, objStore);
        const driveCore = new DriveCore(db, fileCore, objStore);
        const premissionCore = new PermissionCore(db);
        const studyCore = new StudyCore(db, objStore, premissionCore, fileCore);
        const utilsCore = new UtilsCore();
        const dataTransformatonCore = new DataTransformationCore(utilsCore);
        const dataCore = new DataCore(db, objStore, fileCore, premissionCore, utilsCore, dataTransformatonCore);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        webServer.setFileSystem('/DMP', new DMPFileSystem(db, fileCore, driveCore, studyCore, dataCore) as any, (success) => {
            webServer.start(() => Logger.log('DMP file system attached: ' + (success ? 'success' : 'failed')));
        });

        Logger.log('Webdav is starting...');
    }
}

export const dmpWebDav = new DMPWebDav();