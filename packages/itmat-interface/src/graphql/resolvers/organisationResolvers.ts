import { DMPResolversMap } from './context';
import { db } from '../../database/database';
import { OrganisationCore } from '@itmat-broker/itmat-cores';

const organisationCore = Object.freeze(new OrganisationCore(db));

export const organisationResolvers: DMPResolversMap = {
    Query: {
        getOrganisations: async (_parent, args: { organisationId?: string }) => {
            // everyone is allowed to see all organisations in the app.
            return await organisationCore.getOrganisations(args.organisationId);
        }
    },
    Mutation: {
        createOrganisation: async (parent, { name, shortname, containOrg, metadata }: { name: string, shortname: string, containOrg: string, metadata: unknown }, context) => {
            return await organisationCore.createOrganisation(context.req.user, { name, shortname, containOrg, metadata });
        },
        deleteOrganisation: async (parent, { id }: { id: string }, context) => {
            return await organisationCore.deleteOrganisation(context.req.user, id);
        }
    },
    Subscription: {}
};
