import { Models } from 'itmat-utils';
import { Database } from '../../database/database';
import { ForbiddenError, ApolloError, UserInputError, withFilter } from 'apollo-server-express';
import { IFieldEntry } from 'itmat-utils/dist/models/field';
import { objStore } from '../../objStore/objStore';
import uuidv4 from 'uuid/v4';
import { jobCore } from '../core/jobCore';
import { request } from 'https';
import { Logger } from 'itmat-utils';
import { errorCodes } from '../errors';

export const dataResolvers = {
    Query: {},
    Mutation: {
        createCurationJob: async(parent: object, args: { jobType: string, studyId: string, file: Promise<{ stream: NodeJS.ReadableStream, filename: string }>}, context: any, info: any) => {
            const db: Database = context.db;
            const requester: Models.UserModels.IUser = context.req.user;
            const file = await args.file;

            return new Promise(async (resolve, reject) => {
                const jobId = uuidv4();
                /* if the client cancelled the request mid-stream it will throw an error */
                file.stream.on('error', (e) => {
                    Logger.error(e);
                    reject(new ApolloError(errorCodes.FILE_STREAM_ERROR));
                });

                file.stream.on('end', async () => {
                    const job = await jobCore.createJob(requester.username, args.jobType, [file.filename], args.studyId, undefined, jobId);
                    resolve(job);
                });

                try {
                    await objStore.uploadFile(file.stream, args.studyId, jobId);
                } catch (e) {
                    Logger.error(errorCodes.FILE_STREAM_ERROR);
                }
            });
        }
    },
    Subscription: {}
};