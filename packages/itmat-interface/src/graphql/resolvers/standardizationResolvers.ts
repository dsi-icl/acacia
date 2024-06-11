import { DMPResolversMap } from './context';
import { db } from '../../database/database';
import { StandarizationCore } from '@itmat-broker/itmat-cores';
import { objStore } from '../../objStore/objStore';

const standardizationCore = Object.freeze(new StandarizationCore(db, objStore));

export const standardizationResolvers: DMPResolversMap = {
    Query: {
        getStandardization: async (_parent, { studyId, projectId, type, versionId }: { studyId: string, projectId: string, type?: string, versionId: string }, context) => {
            return await standardizationCore.getStandardization(context.req.user, versionId, studyId, projectId, type);
        }
    },
    Mutation: {
        createStandardization: async (_parent, { studyId, standardization }: { studyId: string, standardization }, context) => {
            return standardizationCore.createStandardization(context.req.user, studyId, standardization);
        },
        deleteStandardization: async (_parent, { studyId, type, field }: { studyId: string, type: string, field: string[] }, context) => {
            return standardizationCore.deleteStandardization(context.req.user, studyId, type, field);
        }
    },
    Subscription: {}
};
