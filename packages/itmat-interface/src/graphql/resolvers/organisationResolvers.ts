import { IOrganisation } from '@itmat-broker/itmat-types';
import { db } from '../../database/database';
import { DMPResolversMap } from './context';

export const organisationResolvers: DMPResolversMap = {
    Query: {
        getOrganisations: async (parent, args: { organisationId?: string }) => {
            // everyone is allowed to see all organisations in the app.
            const queryObj = args.organisationId === undefined ? { deleted: null } : { deleted: null, id: args.organisationId };
            const cursor = db.collections.organisations_collection.find<IOrganisation>(queryObj, { projection: { _id: 0 } });
            return cursor.toArray();
        }
    },
    Mutation: {},
    Subscription: {}
};
