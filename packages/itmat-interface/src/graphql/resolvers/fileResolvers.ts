import { FileUpload } from 'graphql-upload-minimal';
import { DMPResolversMap } from './context';
import { db } from '../../database/database';
import { FileCore } from '@itmat-broker/itmat-cores';
import { objStore } from '../../objStore/objStore';

const fileCore = Object.freeze(new FileCore(db, objStore));

export const fileResolvers: DMPResolversMap = {
    Query: {
    },
    Mutation: {
        // this API has the same functions as uploading file data via clinical APIs
        uploadFile: async (_parent, args: { fileLength?: bigint, studyId: string, file: Promise<FileUpload>, description: string, hash?: string }, context) => {
            return await fileCore.uploadFile(context.req.user, args.studyId, args.file, args.description, args.hash, args.fileLength);
        },
        deleteFile: async (_parent, args: { fileId: string }, context) => {
            return await fileCore.deleteFile(context.req.user, args.fileId);
        }
    },
    Subscription: {}
};
