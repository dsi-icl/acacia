import { Request, Response } from 'express';
import { CoreError, IUserWithoutToken, enumCoreErrors } from '@itmat-broker/itmat-types';
import jwt from 'jsonwebtoken';
import { userRetrieval } from '../authentication/pubkeyAuthentication';
import { DBType } from '../database/database';
import { ObjectStore } from '@itmat-broker/itmat-commons';
import { TRPCPermissionCore } from '../trpcCore/permissionCore';

export class FileDownloadController {
    private _permissionCore: TRPCPermissionCore;
    private _db: DBType;
    private _objStore: ObjectStore;

    constructor(db: DBType, objStore: ObjectStore) {
        this._db = db;
        this._permissionCore = new TRPCPermissionCore(db);
        this._objStore = objStore;
    }

    public fileDownloadController = (req: Request, res: Response) => {
        (async () => {
            const requester = req.user as IUserWithoutToken;
            const requestedFile = req.params['fileId'];
            const token = req.headers.authorization || '';
            let associatedUser = requester;
            if ((token !== '') && (req.user === undefined)) {
                // get the decoded payload ignoring signature, no symmetric secret or asymmetric key needed
                const decodedPayload = jwt.decode(token);
                // obtain the public-key of the robot user in the JWT payload
                let pubkey: string;
                if (decodedPayload !== null && !(typeof decodedPayload === 'string')) {
                    pubkey = decodedPayload['publicKey'];
                } else {
                    throw new CoreError(
                        enumCoreErrors.AUTHENTICATION_ERROR,
                        'JWT verification failed.'
                    );
                }
                // verify the JWT
                jwt.verify(token, pubkey, function (error) {
                    if (error) {
                        throw new CoreError(
                            enumCoreErrors.AUTHENTICATION_ERROR,
                            'JWT verification failed.'
                        );
                    }
                });
                associatedUser = await userRetrieval(this._db, pubkey);
            } else if (!requester) {
                res.status(403).json({ error: 'Please log in.' });
                return;
            }
            try {
                /* download file */
                const file = await this._db.collections.files_collection.findOne({ 'id': requestedFile, 'life.deletedTime': null });
                if (!file || !file.studyId) {
                    res.status(404).json({ error: 'File not found or you do not have the necessary permission.' });
                    return;
                }

                // check target field exists
                const roles = await this._permissionCore.getRolesOfUser(associatedUser, associatedUser.id, file.studyId);
                if (!roles.length) {
                    res.status(404).json({ error: 'File not found or you do not have the necessary permission.' });
                    return;
                }

                const stream = await this._objStore.downloadFile(file.studyId, file.uri);
                res.set('Content-Type', 'application/octet-stream');
                res.set('Content-Type', 'application/download');
                res.set('Content-Disposition', `attachment; filename="${file.fileName}"`);
                stream.pipe(res, { end: true });
                return;
            } catch (e) {
                console.log(e);
                res.status(500).json(e);
                return;
            }
        })().catch(() => { return; });
    };
}
