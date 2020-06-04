import { ApolloError } from 'apollo-server-express';
import { Models, permissions, task_required_permissions } from 'itmat-commons';
const { fileTypes } = Models.File;
import { Logger } from 'itmat-utils';
import { v4 as uuid } from 'uuid';
import { db } from '../../database/database';
import { objStore } from '../../objStore/objStore';
import { permissionCore } from '../core/permissionCore';
import { errorCodes } from '../errors';
import { IGenericResponse, makeGenericReponse } from '../responses';
import { IFileForStudyRepoDir, IFileForUserPersonalDir, IFileForUserPersonalFile } from 'itmat-commons/dist/models/file';
type IDirectory = Models.File.IDirectory;
type IFileInMongo = Models.File.IFileInMongo;
type IFileForStudyRepoScriptFile = Models.File.IFileForStudyRepoScriptFile;

export const fileResolvers = {
    File: {
        childFiles: async(file: IDirectory) => {
            return await db.collections!.files_collection.find({ id: { $in: file.childFileIds }, deleted: null }).toArray();
        }
    },
    Query: {
    },
    Mutation: {
        /**
         * user actions:
         * - user create dir for himself
         * - user create file for himself
         * - user upload a zipped/unzipped file for study
         * - user create dir for study
         * - user create script for study
         * - user unzip file -> create job -> may fail
         */
        createFile: async(parent: object, args: any, context: any, info: any): Promise<IFileInMongo> => {
            const requester: Models.UserModels.IUser = context.req.user;
            const { fileName, studyId, fileType } = args;

            let file: FileNode | undefined;
            switch fileType {
                case fileTypes.STUDY_REPO_DIR:
                    /* check permissions */
                    file = new StudyRepoDir(undefined, fileName, requester.id, studyId);
                    break;
                case fileTypes.STUDY_REPO_SCRIPT_FILE:
                    /* check permissions */
                    file = new StudyRepoScriptFile(undefined, fileName, requester.id, studyId);
                    break;
                case fileTypes.USER_PERSONAL_DIR:
                    /* check permissions */

                    file = new UserPersonalDir(undefined, fileName, requester.id);
                    break;
                case fileTypes.USER_PERSONAL_FILE:
                    /* check permissions */

                    file = new UserPersonalFile(undefined, fileName, requester.id);
                    break;
                default:
                    /* some fileTypes are not usable for this function */
                    throw new ApolloError(errorCodes.CLIENT_MALFORMED_INPUT);
            }
            const uploadResult = await file.uploadFileToMongo(db.collections!.files_collection);
            if (uploadResult.result.ok !== 1) {
                throw new ApolloError(errorCodes.CLIENT_MALFORMED_INPUT);
            }
            return file.serialiseToMongoObj();
        },
        uploadFile: async (
            parent: object,
            args: {
                fileLength?: number,
                studyId: string,
                file: Promise<{ stream: NodeJS.ReadableStream, filename: string }>,
                description: string,
                fileType: Models.File.fileType,
            },
            context: any,
            info: any
        ): Promise<IFileInMongo> => {
            const requester: Models.UserModels.IUser = context.req.user;

            /* check permission */
            const hasPermission = await permissionCore.userHasTheNeccessaryPermission(
                task_required_permissions.manage_study_data,
                requester,
                args.studyId
            );
            if (!hasPermission) { throw new ApolloError(errorCodes.NO_PERMISSION_ERROR); }

            const file = await args.file;

            return new Promise<IFileInMongo>(async (resolve, reject) => {
                const stream: NodeJS.ReadableStream = (file as any).createReadStream();
                const fileUri = uuid();

                /* if the client cancelled the request mid-stream it will throw an error */
                stream.on('error', (e) => {
                    Logger.error(e);
                    reject(new ApolloError(errorCodes.FILE_STREAM_ERROR));
                });

                stream.on('end', async () => {
                    let fileObj: ObjStoreFileNode;
                    switch (args.fileType) {
                        case fileTypes.STUDY_REPO_OBJ_STORE_FILE:
                            fileObj = new StudyRepoObjStoreFile(
                                undefined,
                                file.fileName,
                                requester.id,
                                args.description,
                                fileUri,
                                args.studyId,
                                args.fileLength
                            );
                    }

                    const uploadResult = await fileObj.uploadFileToMongo(db.collections!.files_collection);
                    if (uploadResult.result.ok !== 1) {
                        throw new ApolloError(errorCodes.CLIENT_MALFORMED_INPUT);
                    }
                    resolve(fileObj.serialiseToMongoObj());
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

            const file: IFileMongoEntry = await db.collections!.files_collection.findOne({ deleted: null, id: args.fileId });

            if (!file) {
                throw new ApolloError(errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);
            }
            const hasPermission = await permissionCore.userHasTheNeccessaryPermission(
                task_required_permissions.manage_study_data,
                requester,
                file.studyId
            );
            if (!hasPermission) { throw new ApolloError(errorCodes.NO_PERMISSION_ERROR); }

            const deleteResult = await file.deleteFileOnMongo(db.collections!.files_collection);
            if (deleteResult.ok !== 1) {
                throw new ApolloError(errorCodes.DATABASE_ERROR);
            }
            // const updateResult = await db.collections!.files_collection.updateOne({ deleted: null, id: args.fileId }, { $set: { deleted: new Date().valueOf() } });
            // if (updateResult.result.ok === 1) {
                return makeGenericReponse();
            // } else {
            //     throw new ApolloError(errorCodes.DATABASE_ERROR);
            // }
        }
    },
    Subscription: {}
};
