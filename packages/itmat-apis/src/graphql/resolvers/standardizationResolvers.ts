import { DMPResolversMap } from './context';
import { TRPCStandarizationCore } from '@itmat-broker/itmat-cores';

export class StandardizationResolvers {
    standardizationCore: TRPCStandarizationCore;
    constructor(standardizationCore: TRPCStandarizationCore) {
        this.standardizationCore = standardizationCore;
    }

    async getStandardization(_parent, { studyId, projectId, type, versionId }: { studyId: string, projectId: string, type?: string, versionId: string }, context) {
        return await this.standardizationCore.getStandardization(context.req.user, versionId, studyId, projectId, type);
    }

    async createStandardization(_parent, { studyId, standardization }: { studyId: string, standardization }, context) {
        return this.standardizationCore.createStandardization(context.req.user, studyId, standardization);
    }

    async deleteStandardization(_parent, { studyId, type, field }: { studyId: string, type: string, field: string[] }, context) {
        return this.standardizationCore.deleteStandardization(context.req.user, studyId, type, field);
    }

    getResolvers(): DMPResolversMap {
        return {
            Query: {
                getStandardization: this.getStandardization.bind(this)
            },
            Mutation: {
                createStandardization: this.createStandardization.bind(this),
                deleteStandardization: this.deleteStandardization.bind(this)
            }
        };
    }
}