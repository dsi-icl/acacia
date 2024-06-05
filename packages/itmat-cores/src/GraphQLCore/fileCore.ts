import { IData, IFile, IUserWithoutToken, deviceTypes, enumDataAtomicPermissions, enumDataTypes, enumFileCategories, enumFileTypes, enumReservedKeys } from '@itmat-broker/itmat-types';
import { v4 as uuid } from 'uuid';
import { DBType } from '../database/database';
import { FileUpload } from 'graphql-upload-minimal';
import { GraphQLError } from 'graphql';
import { fileSizeLimit } from '../utils/definition';
import crypto from 'crypto';
import { makeGenericReponse } from '../utils/responses';
import { errorCodes } from '../utils/errors';
import { PermissionCore } from './permissionCore';
import { StudyCore } from './studyCore';
import { ObjectStore } from '@itmat-broker/itmat-commons';

// default visitId for file data
export class FileCore {
    db: DBType;
    permissionCore: PermissionCore;
    studyCore: StudyCore;
    objStore: ObjectStore;
    constructor(db: DBType, objStore: ObjectStore) {
        this.db = db;
        this.permissionCore = new PermissionCore(db);
        this.studyCore = new StudyCore(db, objStore);
        this.objStore = objStore;
    }

    public async uploadFile(requester: IUserWithoutToken | undefined, studyId: string, file: Promise<FileUpload>, description: string, hash?: string, fileLength?: bigint) {
        if (!requester) {
            throw new GraphQLError(errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);
        }
        // get the target fieldId of this file
        const study = await this.studyCore.findOneStudy_throwErrorIfNotExist(studyId);
        const roles = await this.permissionCore.getRolesOfUser(requester, studyId);
        if (!roles.length) { throw new GraphQLError(errorCodes.NO_PERMISSION_ERROR); }

        let targetFieldId: string;
        let isStudyLevel = false;
        let dataEntry: IData | null = null;
        // if the description object is empty, then the file is study-level data
        // otherwise, a subjectId must be provided in the description object
        // we will check other properties in the decription object (deviceId, startDate, endDate)
        const parsedDescription = JSON.parse(description);
        if (!parsedDescription) {
            throw new GraphQLError('File description is invalid', { extensions: { code: errorCodes.CLIENT_MALFORMED_INPUT } });
        }
        if (!parsedDescription.participantId) {
            isStudyLevel = true;
            targetFieldId = enumReservedKeys.STUDY_LEVEL_DATA;
            dataEntry = {
                id: uuid(),
                studyId: studyId,
                fieldId: targetFieldId,
                dataVersion: null,
                value: '',
                properties: {},
                life: {
                    createdTime: Date.now(),
                    createdUser: requester.id,
                    deletedTime: null,
                    deletedUser: null
                },
                metadata: {}
            };
        } else {
            isStudyLevel = false;
            // if the targetFieldId is in the description object; then use the fieldId, otherwise, infer it from the device types
            if (parsedDescription.fieldId) {
                targetFieldId = parsedDescription.fieldId;
            } else {
                const device = parsedDescription.deviceId?.slice(0, 3);
                targetFieldId = `Device_${deviceTypes[device].replace(/ /g, '_')}`;
            }
            // check fieldId exists
            if ((await this.db.collections.field_dictionary_collection.find({ 'studyId': study.id, 'fieldId': targetFieldId, 'life.deletedTime': null }).sort({ 'life.createdTime': -1 }).limit(1).toArray()).length === 0) {
                throw new GraphQLError('File description is invalid', { extensions: { code: errorCodes.CLIENT_MALFORMED_INPUT } });
            }
            dataEntry = {
                id: uuid(),
                studyId: studyId,
                fieldId: targetFieldId,
                dataVersion: null,
                value: '',
                properties: {
                    participantId: parsedDescription.participantId,
                    deviceId: parsedDescription.deviceId,
                    startDate: parsedDescription.startDate,
                    endDate: parsedDescription.endDate
                },
                life: {
                    createdTime: Date.now(),
                    createdUser: requester.id,
                    deletedTime: null,
                    deletedUser: null
                },
                metadata: {}
            };
            // check field permission
            if (!this.permissionCore.checkDataPermission(roles, dataEntry, enumDataAtomicPermissions.WRITE)) {
                throw new GraphQLError(errorCodes.NO_PERMISSION_ERROR);
            }
            // TODO: check data is valid
        }

        const file_ = await file;

        return new Promise((resolve, reject) => {
            (async () => {
                try {
                    const fileName: string = file_.filename;
                    let metadata: Record<string, unknown> = {};
                    if (!isStudyLevel) {
                        metadata = {
                            participantId: parsedDescription.participantId,
                            deviceId: parsedDescription.deviceId,
                            startDate: parsedDescription.startDate, // should be in milliseconds
                            endDate: parsedDescription.endDate,
                            tup: parsedDescription.tup
                        };
                    }

                    if (fileLength !== undefined && fileLength > fileSizeLimit) {
                        reject(new GraphQLError('File should not be larger than 8GB', { extensions: { code: errorCodes.CLIENT_MALFORMED_INPUT } }));
                        return;
                    }

                    const stream = file_.createReadStream();
                    const fileUri = uuid();
                    const hash_ = crypto.createHash('sha256');
                    let readBytes = 0;

                    stream.pause();

                    /* if the client cancelled the request mid-stream it will throw an error */
                    stream.on('error', (e) => {
                        reject(new GraphQLError('Upload resolver file stream failure', { extensions: { code: errorCodes.FILE_STREAM_ERROR, error: e } }));
                        return;
                    });

                    stream.on('data', (chunk) => {
                        readBytes += chunk.length;
                        if (readBytes > fileSizeLimit) {
                            stream.destroy();
                            reject(new GraphQLError('File should not be larger than 8GB', { extensions: { code: errorCodes.CLIENT_MALFORMED_INPUT } }));
                            return;
                        }
                        hash_.update(chunk);
                    });

                    await this.objStore.uploadFile(stream, studyId, fileUri);

                    const hashString = hash_.digest('hex');
                    if (hash && hash !== hashString) {
                        reject(new GraphQLError('File hash not match', { extensions: { code: errorCodes.CLIENT_MALFORMED_INPUT } }));
                        return;
                    }

                    // check if readbytes equal to filelength in parameters
                    if (fileLength !== undefined && fileLength.toString() !== readBytes.toString()) {
                        reject(new GraphQLError('File size mismatch', { extensions: { code: errorCodes.CLIENT_MALFORMED_INPUT } }));
                        return;
                    }
                    const fileParts: string[] = file_.filename.split('.');
                    const fileExtension = fileParts.length === 1 ? 'UNKNOWN' : fileParts[fileParts.length - 1].trim().toLowerCase();
                    const fileEntry: IFile = {
                        id: uuid(),
                        studyId: studyId,
                        userId: null,
                        fileName: fileName,
                        fileSize: readBytes,
                        description: description,
                        properties: {},
                        uri: fileUri,
                        hash: hashString,
                        fileType: fileExtension in enumFileTypes ? enumFileTypes[fileExtension] : enumFileTypes.UNKNOWN,
                        fileCategory: enumFileCategories.STUDY_DATA_FILE,
                        sharedUsers: [],
                        life: {
                            createdTime: Date.now(),
                            createdUser: requester.id,
                            deletedTime: null,
                            deletedUser: null
                        },
                        metadata: metadata
                    };
                    dataEntry.value = fileEntry.id;
                    await this.db.collections.data_collection.insertOne(dataEntry);
                    await this.db.collections.files_collection.insertOne(fileEntry);
                    resolve({
                        ...fileEntry,
                        uploadTime: fileEntry.life.createdTime,
                        uploadedBy: requester.id
                    });

                } catch (error) {
                    reject(new GraphQLError('General upload error', { extensions: { code: errorCodes.UNQUALIFIED_ERROR, error } }));
                }
            })().catch((e) => reject(e));
        });
    }

    public async deleteFile(requester: IUserWithoutToken | undefined, fileId: string) {
        if (!requester) {
            throw new GraphQLError(errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);
        }
        const file = await this.db.collections.files_collection.findOne({ 'life.deletedTime': null, 'id': fileId });
        if (!file || !file.studyId || !file.description) {
            throw new GraphQLError(errorCodes.NO_PERMISSION_ERROR);
        }

        const roles = await this.permissionCore.getRolesOfUser(requester, file.studyId);

        if (!roles.length) { throw new GraphQLError(errorCodes.NO_PERMISSION_ERROR); }
        const data = await this.db.collections.data_collection.findOne({ 'value': fileId, 'life.deletedTime': null });
        if (!data) {
            throw new GraphQLError(errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);
        }
        // check if data and file matches
        const field = await this.db.collections.field_dictionary_collection.findOne({ 'fieldId': data.fieldId, 'studyId': file.studyId, 'life.deletedTime': null });
        if (field?.dataType !== enumDataTypes.FILE) {
            throw new GraphQLError(errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);
        }

        // TODO: check user has permission to delete this file
        if (!this.permissionCore.checkDataPermission(roles, data, enumDataAtomicPermissions.DELETE)) {
            throw new GraphQLError(errorCodes.NO_PERMISSION_ERROR);
        }
        // update data record
        await this.db.collections.data_collection.insertOne({
            id: uuid(),
            studyId: file.studyId,
            fieldId: data.fieldId,
            dataVersion: null,
            value: fileId,
            properties: file.properties,
            life: {
                createdTime: Date.now(),
                createdUser: requester.id,
                deletedTime: Date.now(),
                deletedUser: requester.id
            },
            metadata: {}
        });
        return makeGenericReponse(file.id);
    }
}