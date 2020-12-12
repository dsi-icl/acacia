import { ApolloError } from 'apollo-server-express';
import { Models, task_required_permissions, IFile, Logger } from 'itmat-commons';
import { v4 as uuid } from 'uuid';
import { db } from '../../database/database';
import { objStore } from '../../objStore/objStore';
import { permissionCore } from '../core/permissionCore';
import { errorCodes } from '../errors';
import { IGenericResponse, makeGenericReponse } from '../responses';
import { Readable } from 'stream';
import crypto from 'crypto';
import { validate } from '@ideafast/idgen';
import { deviceTypes, sitesIDMarker } from '../../utils/definition';

export const fileSizeLimit = 8589934592;

export const fileResolvers = {
    Query: {
    },
    Mutation: {
        uploadFile: async (__unused__parent: Record<string, unknown>, args: { fileLength?: number, studyId: string, file: Promise<{ stream: Readable, filename: string }>, description: string, hash?: string }, context: any): Promise<IFile> => {
            const requester: Models.UserModels.IUser = context.req.user;

            const hasPermission = await permissionCore.userHasTheNeccessaryPermission(
                task_required_permissions.manage_study_data,
                requester,
                args.studyId
            );
            if (!hasPermission) { throw new ApolloError(errorCodes.NO_PERMISSION_ERROR); }

            const file = await args.file;
            return new Promise<IFile>((resolve, reject) => {
                try {
                    const hash = crypto.createHash('sha256');
                    const countStream: Readable = (file as any).createReadStream();
                    let readBytes = 0;

                    countStream.on('data', chunk => {
                        readBytes += chunk.length;
                        hash.update(chunk);
                        if (readBytes > fileSizeLimit) {
                            reject(new ApolloError('File should not be larger than 8GB', errorCodes.CLIENT_MALFORMED_INPUT));
                            return;
                        }
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
                            if (args.fileLength !== readBytes) {
                                reject(new ApolloError('File size mismatch', errorCodes.CLIENT_MALFORMED_INPUT));
                                return;
                            }
                        }
                        const stream: Readable = (file as any).createReadStream();
                        const fileUri = uuid();

                        /* if the client cancelled the request mid-stream it will throw an error */
                        stream.on('error', (e) => {
                            Logger.error(e);
                            reject(new ApolloError(errorCodes.FILE_STREAM_ERROR));
                        });

                        stream.on('end', async () => {
                            // check filename and description is valid and matches each other
                            const parsedDescription = JSON.parse(args.description);
                            const matcher = /(.{1})(.{6})-(.{3})(.{6})-(\d{8})-(\d{8})\.(.*)/;
                            const particules = file.filename.match(matcher);
                            if (particules !== null) {
                                if ((particules as any).length === 8) {
                                    const parsedFileNameStartDate = new Date((particules as any)[5].substr(0,4).concat('-')
                                        .concat((particules as any)[5].substr(4,2).concat('-').concat((particules as any)[5].substr(6,2)))).valueOf();
                                    const parsedFileNameEndDate = new Date((particules as any)[6].substr(0,4).concat('-')
                                        .concat((particules as any)[6].substr(4,2).concat('-').concat((particules as any)[6].substr(6,2)))).valueOf();
                                    if (!(Object.keys(sitesIDMarker).includes((particules as any)[1].toUpperCase())
                                        && validate((particules as any)[2].toUpperCase())
                                        && (particules as any)[1].concat((particules as any)[2]) === parsedDescription['participantId']
                                        && Object.keys(deviceTypes).includes((particules as any)[3].toUpperCase())
                                        && validate((particules as any)[4].toUpperCase())
                                        && (particules as any)[3].concat((particules as any)[4]) === parsedDescription['deviceId']
                                        && parsedFileNameStartDate < parsedFileNameEndDate
                                        && (parsedFileNameStartDate - parseInt(parsedDescription['startDate'])) === (parsedFileNameEndDate - parseInt(parsedDescription['endDate'])))) {
                                        return reject(new ApolloError('Filename and description must be matched and valid', errorCodes.CLIENT_MALFORMED_INPUT));
                                    }
                                } else {
                                    reject(new ApolloError('Filename and description must be matched and valid', errorCodes.CLIENT_MALFORMED_INPUT));
                                    return;
                                }
                            } else {
                                reject(new ApolloError('Filename and description must be matched and valid', errorCodes.CLIENT_MALFORMED_INPUT));
                                return;
                            }

                            const fileEntry: IFile = {
                                id: uuid(),
                                fileName: file.filename,
                                studyId: args.studyId,
                                fileSize: readBytes,
                                description: args.description,
                                uploadTime: `${Date.now()}`,
                                uploadedBy: requester.id,
                                uri: fileUri,
                                deleted: null,
                                hash: hashString
                            };

                            const insertResult = await db.collections!.files_collection.insertOne(fileEntry);
                            if (insertResult.result.ok === 1) {
                                resolve(fileEntry);
                            } else {
                                throw new ApolloError(errorCodes.DATABASE_ERROR);
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
            const requester: Models.UserModels.IUser = context.req.user;

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
            if (updateResult.result.ok === 1) {
                return makeGenericReponse();
            } else {
                throw new ApolloError(errorCodes.DATABASE_ERROR);
            }
        }
    },
    Subscription: {}
};
