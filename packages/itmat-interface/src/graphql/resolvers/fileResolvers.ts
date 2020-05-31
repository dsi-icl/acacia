import { ApolloError } from 'apollo-server-express';
import { Models, permissions, task_required_permissions } from 'itmat-commons';
const { fileType } = Models.File;
import { IFile } from 'itmat-commons/dist/models/file';
import { Logger } from 'itmat-utils';
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
        uploadFile: async (
            parent: object,
            args: {
                fileLength?: number,
                studyId: string,
                file: Promise<{ stream: NodeJS.ReadableStream, filename: string }>,
                description: string,
                fileType?: Models.File.fileType,
                isZipped?: boolean
            },
            context: any,
            info: any
        ): Promise<IFile> => {
            const requester: Models.UserModels.IUser = context.req.user;

            /* check permission */
            const hasPermission = await permissionCore.userHasTheNeccessaryPermission(
                task_required_permissions.manage_study_data,
                requester,
                args.studyId
            );
            if (!hasPermission) { throw new ApolloError(errorCodes.NO_PERMISSION_ERROR); }

            /* only dir can be zipped */
            if (args.isZipped && args.fileType !== undefined &&
                args.fileType !== fileType.STUDY_REPO_DIR &&
                args.fileType !== fileType.PATIENT_DATA_BLOB_DIR &&
                args.fileType !== fileType.USER_PERSONAL_DIR
            ) {
                throw new ApolloError(errorCodes.CLIENT_MALFORMED_INPUT);
            }

            const file = await args.file;

            return new Promise<IFile>(async (resolve, reject) => {
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
                        fileType: args.fileType ?? fileType.STUDY_REPO_FILE,
                        fileSize: args.fileLength === undefined ? 0 : args.fileLength,
                        isZipped: args.isZipped === true,
                        description: args.description,
                        uploadedBy: requester.id,
                        uri: fileUri,
                        deleted: null,
                        extraData: undefined
                    };

                    const insertResult = await db.collections!.files_collection.insertOne(fileEntry);
                    if (insertResult.result.ok === 1) {
                        resolve(fileEntry);
                    } else {
                        throw new ApolloError(errorCodes.DATABASE_ERROR);
                    }
                });

                try {
                    await objStore.uploadFile(stream, args.studyId, fileUri);
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
