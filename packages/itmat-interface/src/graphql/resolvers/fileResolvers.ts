import { ApolloError } from 'apollo-server-express';
import { Models, permissions, IFile, Logger } from 'itmat-commons';
import { v4 as uuid } from 'uuid';
import { db } from '../../database/database';
import { objStore } from '../../objStore/objStore';
import { permissionCore } from '../core/permissionCore';
import { errorCodes } from '../errors';
import { IGenericResponse, makeGenericReponse } from '../responses';
import { Readable } from 'stream';

export const fileResolvers = {
    Query: {
    },
    Mutation: {
        uploadFile: async (__unused__parent: Record<string, unknown>, args: { fileLength?: number, studyId: string, file: Promise<{ stream: Readable, filename: string }>, description: string }, context: any): Promise<IFile> => {
            const requester: Models.UserModels.IUser = context.req.user;

            const hasPermission = await permissionCore.userHasTheNeccessaryPermission(
                permissions.dataset_specific.files.upload_files,
                requester,
                args.studyId
            );
            if (!hasPermission) { throw new ApolloError(errorCodes.NO_PERMISSION_ERROR); }

            const file = await args.file;

            return new Promise<IFile>((resolve, reject) => {
                try {

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
                            uploadedBy: requester.id,
                            uri: fileUri,
                            deleted: null
                        };

                        const insertResult = await db.collections!.files_collection.insertOne(fileEntry);
                        if (insertResult.result.ok === 1) {
                            resolve(fileEntry);
                        } else {
                            throw new ApolloError(errorCodes.DATABASE_ERROR);
                        }
                    });

                    objStore.uploadFile(stream, args.studyId, fileUri);
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
                permissions.dataset_specific.files.delete_files,
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
