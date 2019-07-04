import { Models, Logger } from 'itmat-utils';
import { Database, db } from '../../database/database';
import { ForbiddenError, ApolloError, UserInputError, withFilter } from 'apollo-server-express';
import { IStudy } from 'itmat-utils/dist/models/study';
import { makeGenericReponse, IGenericResponse } from '../responses';
import { IQueryEntry } from 'itmat-utils/dist/models/query';
import uuid from 'uuid/v4';
import mongodb from 'mongodb';
import { pubsub, subscriptionEvents } from '../pubsub';
import { queryCore } from '../core/queryCore';
import { IFile } from 'itmat-utils/dist/models/file';
import { objStore } from '../../objStore/objStore';
import { errorCodes } from '../errors';


export const fileResolvers = {
    Query: {
    },
    Mutation: {
        uploadFile: async(parent: object, args: { projectId?: string, studyId: string, file: Promise<{ stream: NodeJS.ReadableStream, filename: string }>, description: string }, context: any, info: any): Promise<IFile> => {
            const requester: Models.UserModels.IUser = context.req.user;
            const file = await args.file;

            return new Promise<IFile>(async (resolve, reject) => {
                const fileUri = uuid();
                /* if the client cancelled the request mid-stream it will throw an error */
                file.stream.on('error', (e) => {
                    Logger.error(e);
                    reject(new ApolloError(errorCodes.FILE_STREAM_ERROR));
                });

                file.stream.on('end', async () => {
                    const fileEntry: IFile = {
                        id: uuid(),
                        fileName: file.filename,
                        studyId: args.studyId,
                        projectId: args.projectId,
                        fileSize: 0,
                        description: args.description,
                        uploadedBy: requester.id,
                        uri: fileUri,
                        deleted: false
                    };

                    const insertResult = await db.collections!.files_collection.insertOne(fileEntry);
                    if (insertResult.result.ok === 1) {
                        resolve(fileEntry);
                    } else {
                        throw new ApolloError(errorCodes.DATABASE_ERROR);
                    }
                });

                try {
                    await objStore.uploadFile(file.stream, args.studyId, fileUri);
                } catch (e) {
                    Logger.error(errorCodes.FILE_STREAM_ERROR);
                }
            });
        },
        deleteFile: async(parent: object, args: { projectId?: string, studyId: string, fileId: string }, context: any, info: any): Promise<IGenericResponse> => {
            const requester: Models.UserModels.IUser = context.req.user;

            const updateResult = await db.collections!.files_collection.updateOne({ deleted: false, id: args.fileId }, { $set: { deleted: true } });
            if (updateResult.result.ok === 1) {
                return makeGenericReponse();
            } else {
                throw new ApolloError(errorCodes.DATABASE_ERROR);
            }
        }
    },
    Subscription: {}
};