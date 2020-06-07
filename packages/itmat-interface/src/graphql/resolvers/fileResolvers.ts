import { ApolloError } from 'apollo-server-express';
import { Models, permissions, task_required_permissions } from 'itmat-commons';
const { File: {
        FileNode,
        UserPersonalDir,
        UserPersonalFile,
        StudyRepoDir,
        StudyRepoScriptFile,
        ObjStoreFileNode,
        StudyRepoObjStoreFile,
        PatientDataBlobFile,
        fileTypes,
        fileTypesStudy,
        fileTypesPersonal
    }, JobModels: {
        zipFormats
    }} = Models;
import { Logger } from 'itmat-utils';
import { v4 as uuid } from 'uuid';
import { db } from '../../database/database';
import { objStore } from '../../objStore/objStore';
import { permissionCore } from '../core/permissionCore';
import { errorCodes } from '../errors';
import { IGenericResponse, makeGenericReponse } from '../responses';
type IFileMongoEntry = Models.File.IFileMongoEntry;
type IStudyFileNode = Models.File.IStudyFileNode;
type FileNode = Models.File.FileNode;
type IUser = Models.UserModels.IUser;
type ObjStoreFileNode = Models.File.ObjStoreFileNode;
type StudyRepoObjStoreFile = Models.File.StudyRepoObjStoreFile;
type IJobEntryForUnzippingFile = Models.JobModels.IJobEntryForUnzippingFile;


export const fileResolvers = {
    File: {
        childFiles: async(file: IFileMongoEntry) => {
            return await db.collections!.files_collection.find({ id: { $in: file.childFileIds }, deleted: null }).toArray();
        }
    },
    Query: {
    },
    Mutation: {
        /**
         * user actions:
         * - user create dir for himself (createFile)
         * - user create file for himself (createFile)
         * - user create dir for study (createFile)
         * - user create script for study (createFile)
         *
         * - user delete file (deleteFile)
         *
         * - user upload a zipped/unzipped file for study (uploadFile)
         *
         * - user turn study objstore file to patient blob (in job resolver, handled by job executor)
         *
         * - user unzip file -> create job -> may fail (createJobForUnzippingFile)
         */
        createJobForUnzippingFile: async(parent: object, args: { fileId: string }, context: any, info: any): Promise<IJobEntryForUnzippingFile> => {
            const requester: IUser = context.req.user;
            const { fileId } = args;

            /* check if file exists */
            const fileEntry: IFileMongoEntry | null = await FileNode.findFileOnMongo(db.collections!.files_collection, { id: fileId });
            if (!fileEntry) {
                throw new Error(errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);
            }

            /* file type must be object store file */
            let file: StudyRepoObjStoreFile;
            try {
                file = StudyRepoObjStoreFile.makeFromMongoEntry(fileEntry);
            } catch (e) {
                throw new Error(`Cannot unzip file of type ${fileEntry.fileType}.`);
            }

            /* check permission */
            const hasPermission = await permissionCore.userHasTheNeccessaryPermission(
                task_required_permissions.manage_study_data,
                requester,
                file.studyId
            );
            if (!hasPermission) { throw new ApolloError(errorCodes.NO_PERMISSION_ERROR); }

            /* check extension */
            if (!/.zip$/.test(file.fileName)) {
                throw new Error('Trying to unzip file with wrong extension.');
            }

            /* create job */
            const job: IJobEntryForUnzippingFile = {
                id: uuid(),
                jobType: 'UNZIP',
                studyId: file.studyId,
                requester: requester.id,
                requestTime: new Date().valueOf(),
                receivedFiles: [],
                status: 'QUEUED',
                error: null,
                cancelled: false,
                data: {
                    fileId,
                    zipFormat: zipFormats.ZIP
                }
            };

            const insertResult = await db.collections!.files_collection.insertOne(job);
            if (insertResult.result.ok !== 1) {
                throw new ApolloError(errorCodes.DATABASE_ERROR);
            }
            return job;
        },
        createFile: async(parent: object, args: any, context: any, info: any): Promise<IFileMongoEntry> => {
            const requester: IUser = context.req.user;
            const { fileName, studyId, fileType } = args;

            /* check permissions */
            let hasPermission = false;
            if (fileTypesStudy.includes(fileType)) {
                hasPermission = await permissionCore.userHasTheNeccessaryPermission(
                    task_required_permissions.manage_study_data,
                    requester,
                    studyId
                );
            } else if (fileTypesPersonal.includes(fileType)){
                hasPermission = await permissionCore.userHasTheNeccessaryPermission(
                    task_required_permissions.manage_study_data,
                    requester,
                    studyId
                );
            } else {
                /* some fileTypes are not usable for this function */
                throw new ApolloError('File type not supported');
            }
            if (!hasPermission) { throw new ApolloError(errorCodes.NO_PERMISSION_ERROR);}

            /* create the appropriate file */
            let file: FileNode | undefined;
            switch (fileType) {
                case fileTypes.STUDY_REPO_DIR:
                    file = new StudyRepoDir({ fileName, uploadedBy: requester.id, studyId });
                    break;
                case fileTypes.STUDY_REPO_SCRIPT_FILE:
                    file = new StudyRepoScriptFile({ fileName, uploadedBy: requester.id, studyId });
                    break;
                case fileTypes.USER_PERSONAL_DIR:
                    file = new UserPersonalDir({ fileName, userId: requester.id });
                    break;
                case fileTypes.USER_PERSONAL_FILE:
                    file = new UserPersonalFile({ fileName, userId: requester.id });
                    break;
                default:
                    throw new ApolloError(errorCodes.CLIENT_MALFORMED_INPUT);
            }
            if (!file) {
                throw new ApolloError(errorCodes.SERVER_ERROR);
            }

            /* upload file to mongo */
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
                fileType: Models.File.fileTypes,
            },
            context: any,
            info: any
        ): Promise<IFileMongoEntry> => {
            const requester: IUser = context.req.user;

            /* check permission */
            const hasPermission = await permissionCore.userHasTheNeccessaryPermission(
                task_required_permissions.manage_study_data,
                requester,
                args.studyId
            );
            if (!hasPermission) { throw new ApolloError(errorCodes.NO_PERMISSION_ERROR); }

            const file = await args.file;

            return new Promise<IFileMongoEntry>(async (resolve, reject) => {
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
                            fileObj = new StudyRepoObjStoreFile({
                                fileName: file.filename,
                                uploadedBy: requester.id,
                                description: args.description,
                                uri: fileUri,
                                fileSize: args.fileLength,
                                studyId: args.studyId
                            });
                            break;
                        default:
                            throw new ApolloError(errorCodes.CLIENT_MALFORMED_INPUT);
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
            const requester: IUser = context.req.user;

            const fileentry: IFileMongoEntry | null = await db.collections!.files_collection.findOne({ deleted: null, id: args.fileId });
            if (!fileentry) {
                throw new ApolloError(errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);
            }

            let file: FileNode;
            try {
                file = FileNode.makeFromMongoEntry(fileentry);
            } catch (e) {
                throw new ApolloError(errorCodes.DATABASE_ERROR);
            }

            /* check permission */
            let hasPermission: boolean = false;
            if (fileTypesStudy.includes(file.fileType)) { // if file is of study type
                if (PatientDataBlobFile.validateInstance(fileentry)) { // if file is of type patient blob

                } else {
                    hasPermission = await permissionCore.userHasTheNeccessaryPermission(
                        task_required_permissions.manage_study_data,
                        requester,
                        (file as FileNode & IStudyFileNode).studyId
                    );
                }
            } else if (fileTypesPersonal.includes(file.fileType)) { // if file is a personal file then only user themself can delete
                hasPermission = requester.id === file.uploadedBy;
            } else {
                throw new ApolloError(errorCodes.DATABASE_ERROR);
            }
            if (!hasPermission) { throw new ApolloError(errorCodes.NO_PERMISSION_ERROR); }

            /* delete file */
            const deleteResult = await file.deleteFileOnMongo(db.collections!.files_collection);
            if (deleteResult.ok !== 1) {
                throw new ApolloError(errorCodes.DATABASE_ERROR);
            }
            return makeGenericReponse();
        }
    },
    Subscription: {}
};
