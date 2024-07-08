import { DMPResolversMap } from './context';
import { db } from '../../database/database';
import { TRPCFileCore, TRPCOrganisationCore } from '@itmat-broker/itmat-cores';
import { objStore } from '../../objStore/objStore';

const organisationCore = new TRPCOrganisationCore(db, new TRPCFileCore(db, objStore));

export const organisationResolvers: DMPResolversMap = {
    Query: {
        getOrganisations: async (_parent, args: { organisationId?: string }) => {
            return await organisationCore.getOrganisations(undefined, args.organisationId);
        }
    },
    Mutation: {
        createOrganisation: async (parent, { name, shortname }: { name: string, shortname: string, containOrg: string, metadata: unknown }, context) => {
            return await organisationCore.createOrganisation(context.req.user, name, shortname);
        },
        deleteOrganisation: async (parent, { id }: { id: string }, context) => {
            return await organisationCore.deleteOrganisation(context.req.user, id);
        }
    },
    Subscription: {}
};
