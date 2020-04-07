import { ApolloError } from 'apollo-server-express';
import { Models, task_required_permissions } from '@itmat/commons';
import { IFile } from '@itmat/commons';
import { Logger } from '@itmat/utils';
import { v4 as uuid } from 'uuid';
import { db } from '../../database/database';
import { objStore } from '../../objStore/objStore';
import { permissionCore } from '../core/permissionCore';
import { errorCodes } from '../errors';
import { IGenericResponse, makeGenericReponse } from '../responses';

export const fileResolvers = {
    Query: {
    },
    Mutation: {
        uploadFile: async (parent: object, args: { fileLength?: number; studyId: string; file: Promise<{ stream: NodeJS.ReadableStream; filename: string }>; description: string }, context: any, info: any): Promise<IFile> => {
            const requester: Models.UserModels.IUser = context.req.user;

            const hasPermission = await permissionCore.userHasTheNeccessaryPermission(
                task_required_permissions.manage_study_data,
                requester,
                args.studyId
            );
            if (!hasPermission) { throw new ApolloError(errorCodes.NO_PERMISSION_ERROR); }

            const file = await args.file;

            return new Promise<IFile>((resolve, reject) => {
                const stream: NodeJS.ReadableStream = (file as any).createReadStream();
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

                try {
                    objStore.uploadFile(stream, args.studyId, fileUri);
                } catch (e) {
                    Logger.error(errorCodes.FILE_STREAM_ERROR);
                }
            });
        },
        deleteFile: async (parent: object, args: { fileId: string }, context: any, info: any): Promise<IGenericResponse> => {
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
