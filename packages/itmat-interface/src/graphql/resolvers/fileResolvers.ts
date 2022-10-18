import { ApolloError } from 'apollo-server-express';
import { IFile, studyType, IOrganisation, IUser, task_required_permissions } from '@itmat-broker/itmat-types';
import { Logger } from '@itmat-broker/itmat-commons';
import { v4 as uuid } from 'uuid';
import { FileUpload } from 'graphql-upload-minimal';
import { db } from '../../database/database';
import { objStore } from '../../objStore/objStore';
import { permissionCore } from '../core/permissionCore';
import { errorCodes } from '../errors';
import { IGenericResponse, makeGenericReponse } from '../responses';
import { Readable } from 'stream';
import crypto from 'crypto';
import { validate } from '@ideafast/idgen';
import { deviceTypes, fileSizeLimit } from '../../utils/definition';
import { WriteStream } from 'fs-capacitor';

export const fileResolvers = {
    Query: {
    },
    Mutation: {
        uploadFile: async (__unused__parent: Record<string, unknown>, args: { fileLength?: number, studyId: string, file: Promise<FileUpload>, description: string, hash?: string }, context: any): Promise<IFile> => {
            const requester: IUser = context.req.user;

            const hasPermission = await permissionCore.userHasTheNeccessaryPermission(
                task_required_permissions.manage_study_data,
                requester,
                args.studyId
            );
            if (!hasPermission) { throw new ApolloError(errorCodes.NO_PERMISSION_ERROR); }

            const study = await db.collections!.studies_collection.findOne({ id: args.studyId });
            if (!study) {
                throw new ApolloError('Study does not exist.');
            }

            const file = await args.file;
            const fileNameParts = file.filename.split('.');

            // obtain sitesIDMarker from db
            const sitesIDMarkers = (await db.collections!.organisations_collection.find<IOrganisation>({ deleted: null }).toArray()).reduce<any>((acc, curr) => {
                if (curr.metadata?.siteIDMarker) {
                    acc[curr.metadata.siteIDMarker] = curr.shortname;
                }
                return acc;
            }, {});

            return new Promise<IFile>((resolve, reject) => {
                try {
                    const capacitor = new WriteStream();
                    const hash = crypto.createHash('sha256');
                    const stream: Readable = file.createReadStream();

                    capacitor.on('error', () => {
                        stream.unpipe();
                        stream.resume();
                    });

                    stream.on('limit', () => {
                        capacitor.destroy(new Error('File truncated as it exceeds the byte size limit'));
                    });

                    stream.on('error', (error) => {
                        capacitor.destroy(error);
                    });

                    Object.defineProperty(file, 'capacitor', {
                        enumerable: false,
                        configurable: false,
                        writable: false
                    });

                    stream.pipe(capacitor);

                    const countStream = capacitor.createReadStream();
                    let readBytes = 0;

                    countStream.on('data', chunk => {
                        readBytes += chunk.length;
                        hash.update(chunk);
                    });

                    countStream.on('error', (e) => {
                        Logger.error(e);
                        reject(new ApolloError(errorCodes.FILE_STREAM_ERROR));
                        return;
                    });

                    countStream.on('end', () => {
                        // hash is optional, but should be correct if provided
                        const hashString = hash.digest('hex');
                        if (args.hash !== undefined) {
                            if (args.hash !== hashString) {
                                reject(new ApolloError('File hash not match', errorCodes.CLIENT_MALFORMED_INPUT));
                                return;
                            }
                        }
                        // check if readbytes equal to filelength in parameters
                        if (args.fileLength !== undefined) {
                            // const parsedBigInt = args.fileLength.toString().substring(0, args.fileLength.toString().length);
                            const parsedBigInt = args.fileLength.toString();
                            if (parsedBigInt !== readBytes.toString()) {
                                reject(new ApolloError('File size mismatch', errorCodes.CLIENT_MALFORMED_INPUT));
                                return;
                            }
                        }
                        if (readBytes > fileSizeLimit) {
                            reject(new ApolloError('File should not be larger than 8GB', errorCodes.CLIENT_MALFORMED_INPUT));
                            return;
                        }
                        const stream: Readable = capacitor.createReadStream();
                        const fileUri = uuid();

                        /* if the client cancelled the request mid-stream it will throw an error */
                        stream.on('error', (e) => {
                            Logger.error(e);
                            reject(new ApolloError(errorCodes.FILE_STREAM_ERROR));
                            return;
                        });

                        stream.on('end', async () => {
                            // description varies: SENSOR, CLINICAL (only participantId), ANY (No check)
                            // check filename and description is valid and matches each other
                            const parsedDescription = JSON.parse(args.description);
                            if (study.type === undefined || study.type === null || study.type === studyType.SENSOR || study.type === studyType.CLINICAL) {
                                let startDate;
                                let endDate;
                                try {
                                    startDate = parseInt(parsedDescription.startDate);
                                    endDate = parseInt(parsedDescription.endDate);
                                    if (
                                        !Object.keys(sitesIDMarkers).includes(parsedDescription.participantId?.substr(0, 1)?.toUpperCase()) ||
                                        !Object.keys(deviceTypes).includes(parsedDescription.deviceId?.substr(0, 3)?.toUpperCase()) ||
                                        !validate(parsedDescription.participantId?.substr(1) ?? '') ||
                                        !validate(parsedDescription.deviceId.substr(3) ?? '') ||
                                        !startDate || !endDate ||
                                        (new Date(endDate).setHours(0, 0, 0, 0).valueOf()) > (new Date().setHours(0, 0, 0, 0).valueOf())
                                    ) {
                                        reject(new ApolloError('File description is invalid', errorCodes.CLIENT_MALFORMED_INPUT));
                                        return;
                                    }
                                } catch (e) {
                                    reject(new ApolloError('Missing file description', errorCodes.CLIENT_MALFORMED_INPUT));
                                    return;
                                }

                                const matcher = /(.{1})(.{6})-(.{3})(.{6})-(\d{8})-(\d{8})\.(.*)/;
                                const typedStartDate = new Date(startDate);
                                const formattedStartDate = typedStartDate.getFullYear() + `${typedStartDate.getMonth() + 1}`.padStart(2, '0') + `${typedStartDate.getDate()}`.padStart(2, '0');
                                const typedEndDate = new Date(startDate);
                                const formattedEndDate = typedEndDate.getFullYear() + `${typedEndDate.getMonth() + 1}`.padStart(2, '0') + `${typedEndDate.getDate()}`.padStart(2, '0');
                                const fileEntry: IFile = {
                                    id: uuid(),
                                    fileName: matcher.test(file.filename)
                                        ? file.filename :
                                        `${parsedDescription.participantId.toUpperCase()}-${parsedDescription.deviceId.toUpperCase()}-${formattedStartDate}-${formattedEndDate}.${fileNameParts[fileNameParts.length - 1]}`,
                                    studyId: args.studyId,
                                    fileSize: readBytes.toString(),
                                    description: args.description,
                                    uploadTime: `${Date.now()}`,
                                    uploadedBy: requester.id,
                                    uri: fileUri,
                                    deleted: null,
                                    hash: hashString
                                };

                                const insertResult = await db.collections!.files_collection.insertOne(fileEntry);
                                if (insertResult.acknowledged) {
                                    resolve(fileEntry);
                                } else {
                                    throw new ApolloError(errorCodes.DATABASE_ERROR);
                                }
                            } else if (study.type === studyType.ANY) {
                                const fileEntry: IFile = {
                                    id: uuid(),
                                    fileName: file.filename,
                                    studyId: args.studyId,
                                    fileSize: readBytes.toString(),
                                    description: args.description,
                                    uploadTime: `${Date.now()}`,
                                    uploadedBy: requester.id,
                                    uri: fileUri,
                                    deleted: null,
                                    hash: hashString
                                };
                                const insertResult = await db.collections!.files_collection.insertOne(fileEntry);
                                if (insertResult.acknowledged) {
                                    resolve(fileEntry);
                                } else {
                                    throw new ApolloError(errorCodes.DATABASE_ERROR);
                                }
                            }
                        });
                        objStore.uploadFile(stream, args.studyId, fileUri);
                    });
                } catch (e) {
                    Logger.error(errorCodes.FILE_STREAM_ERROR);
                }
            });
        },
        deleteFile: async (__unused__parent: Record<string, unknown>, args: { fileId: string }, context: any): Promise<IGenericResponse> => {
            const requester: IUser = context.req.user;

            const file = await db.collections!.files_collection.findOne({ deleted: null, id: args.fileId });

            if (!file) {
                throw new ApolloError(errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);
            }
            const hasPermission = await permissionCore.userHasTheNeccessaryPermission(
                task_required_permissions.manage_study_data,
                requester,
                file.studyId
            );
            if (!hasPermission) { throw new ApolloError(errorCodes.NO_PERMISSION_ERROR); }

            const updateResult = await db.collections!.files_collection.updateOne({ deleted: null, id: args.fileId }, { $set: { deleted: new Date().valueOf() } });
            if (updateResult.modifiedCount === 1 || updateResult.upsertedCount === 1) {
                return makeGenericReponse();
            } else {
                throw new ApolloError(errorCodes.DATABASE_ERROR);
            }
        }
    },
    Subscription: {}
};
