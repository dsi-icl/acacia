import { Request, Response } from 'express';
import { CoreError, ILog, IUserWithoutToken, defaultSettings, enumAPIResolver, enumCoreErrors, enumEventStatus, enumEventType, enumFileCategories } from '@itmat-broker/itmat-types';
import jwt from 'jsonwebtoken';
import { userRetrieval } from '../authentication/pubkeyAuthentication';
import { DBType } from '../database/database';
import { ObjectStore } from '@itmat-broker/itmat-commons';
import { PermissionCore } from '../coreFunc/permissionCore';
import { v4 as uuid } from 'uuid';
export class FileDownloadController {
    private _permissionCore: PermissionCore;
    private _db: DBType;
    private _objStore: ObjectStore;

    constructor(db: DBType, objStore: ObjectStore) {
        this._db = db;
        this._permissionCore = new PermissionCore(db);
        this._objStore = objStore;
    }

    public fileDownloadController = (req: Request, res: Response) => {
        (async () => {
            const requester = req.user as IUserWithoutToken;
            const requestedFile = req.params['fileId'];
            const token = req.headers.authorization || '';
            let associatedUser = requester;

            const log: ILog = {
                id: uuid(),
                requester: req.user?.username ?? 'NA',
                type: enumEventType.API_LOG,
                apiResolver: enumAPIResolver.FILE,
                event: 'FileDownload',
                parameters: {
                    fileId: requestedFile
                },
                status: enumEventStatus.FAIL,
                errors: '',
                timeConsumed: null,
                life: {
                    createdTime: Date.now(),
                    createdUser: requester?.id || 'anonymous',
                    deletedTime: null,
                    deletedUser: null
                },
                metadata: {
                }
            };

            // Handle authentication first, before any file operations
            if (!requester && token === '') {
                res.status(403).json({ error: 'Please log in.' });
                await this._db.collections.log_collection.insertOne({
                    ...log,
                    errors: 'Please log in.'
                });
                return;
            }

            const file = await this._db.collections.files_collection.findOne({ 'id': requestedFile, 'life.deletedTime': null });

            if (!file || file.fileCategory !== enumFileCategories.DOMAIN_FILE) {
                if ((token !== '') && (req.user === undefined)) {
                    // get the decoded payload ignoring signature, no symmetric secret or asymmetric key needed
                    const decodedPayload = jwt.decode(token);
                    // obtain the public-key of the robot user in the JWT payload
                    let pubkey: string;
                    if (decodedPayload !== null && !(typeof decodedPayload === 'string')) {
                        pubkey = decodedPayload['publicKey'];
                    } else {
                        await this._db.collections.log_collection.insertOne({
                            ...log,
                            errors: 'JWT verification failed.'
                        });
                        throw new CoreError(
                            enumCoreErrors.AUTHENTICATION_ERROR,
                            'JWT verification failed.'
                        );
                    }
                    // verify the JWT
                    try {
                        jwt.verify(token, pubkey);
                    } catch (__unused) {
                        await this._db.collections.log_collection.insertOne(log);
                        throw new CoreError(
                            enumCoreErrors.AUTHENTICATION_ERROR,
                            'JWT verification failed.'
                        );
                    }
                    associatedUser = await userRetrieval(this._db, pubkey);
                } else if (!requester) {
                    res.status(403).json({ error: 'Please log in.' });
                    await this._db.collections.log_collection.insertOne({
                        ...log,
                        errors: 'Please log in.'
                    });
                    return;
                }
            }
            try {
                /* download file */
                if (!file) {
                    res.status(404).json({ error: 'File not found' });
                    await this._db.collections.log_collection.insertOne({
                        ...log,
                        errors: 'File not found'
                    });
                    return;
                }

                // check target field exists
                if (file.studyId) {
                    const roles = await this._permissionCore.getRolesOfUser(associatedUser, associatedUser.id, file.studyId);
                    if (!roles.length) {
                        res.status(404).json({ error: 'You do not have the necessary permission.' });
                        await this._db.collections.log_collection.insertOne({
                            ...log,
                            errors: 'You do not have the necessary permission.'
                        });
                        return;
                    }
                }
                let buckerId = '';
                if (file.fileCategory === enumFileCategories.STUDY_DATA_FILE) {
                    buckerId = file.studyId || '';
                } else if (file.fileCategory === enumFileCategories.USER_DRIVE_FILE) {
                    buckerId = defaultSettings.userConfig.defaultFileBucketId;
                } else if (file.fileCategory === enumFileCategories.CACHE) {
                    buckerId = defaultSettings.cacheConfig.defaultFileBucketId;
                } else if (file.fileCategory === enumFileCategories.DOMAIN_FILE) {
                    buckerId = defaultSettings.domainConfig.defaultFileBucketId;
                } else if (file.fileCategory === enumFileCategories.PROFILE_FILE) {
                    buckerId = defaultSettings.systemConfig.defaultProfileBucketId;
                }
                await this._db.collections.log_collection.insertOne({
                    ...log,
                    status: enumEventStatus.SUCCESS,
                    errors: ''
                });
                const stream = await this._objStore.downloadFile(buckerId, file.uri);
                res.set('Content-Type', 'application/octet-stream');
                res.set('Content-Type', 'application/download');
                res.set('Content-Disposition', `attachment; filename="${file.fileName}"`);
                stream.pipe(res, { end: true });
                return;
            } catch (e) {
                await this._db.collections.log_collection.insertOne({
                    ...log,
                    status: enumEventStatus.FAIL,
                    errors: e instanceof Error ? e.message : 'Unknown error'
                });
                res.status(500).json(e);
                return;
            }
        })().catch(() => { return; });
    };
}
