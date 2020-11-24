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

                    countStream.on('data', chunk => {
                        hash.update(chunk);
                    });

                    countStream.on('end', () => {
                        const hashString = hash.digest('hex');
                        // hash is optional, but should be correct if provided
                        if (args.hash !== undefined) {
                            if (args.hash !== hashString) {
                                reject(new ApolloError('File hash not match', errorCodes.CLIENT_MALFORMED_INPUT));
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
                            const fileEntry: IFile = {
                                id: uuid(),
                                fileName: file.filename,
                                studyId: args.studyId,
                                fileSize: args.fileLength === undefined ? 0 : args.fileLength,
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
