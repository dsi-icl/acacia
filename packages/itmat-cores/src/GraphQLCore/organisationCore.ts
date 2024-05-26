import { IOrganisation, IUserWithoutToken, enumUserTypes } from '@itmat-broker/itmat-types';
import { DBType } from '../database/database';
import { GraphQLError } from 'graphql';
import { errorCodes } from '../utils/errors';
import { v4 as uuid } from 'uuid';

export class OrganisationCore {
    db: DBType;
    constructor(db: DBType) {
        this.db = db;
    }

    public async getOrganisations(organisationId?: string) {
        const queryObj = organisationId === undefined ? { deleted: null } : { deleted: null, id: organisationId };
        return await this.db.collections.organisations_collection.find<IOrganisation>(queryObj, { projection: { _id: 0 } }).toArray();
    }

    public async createOrganisation(requester: IUserWithoutToken | undefined, org: { name: string, shortname: string | undefined, containOrg: string | null, metadata }): Promise<IOrganisation> {
        if (!requester) {
            throw new GraphQLError(errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);
        }
        /* check privileges */
        if (requester.type !== enumUserTypes.ADMIN) {
            throw new GraphQLError(errorCodes.NO_PERMISSION_ERROR);
        }
        const { name, shortname, metadata } = org;
        const entry: IOrganisation = {
            id: uuid(),
            name,
            shortname,
            metadata: metadata?.siteIDMarker ? {
                siteIDMarker: metadata.siteIDMarker
            } : {},
            life: {
                createdTime: Date.now(),
                createdUser: requester.id,
                deletedTime: null,
                deletedUser: null
            }
        };
        const result = await this.db.collections.organisations_collection.findOneAndUpdate({ name: name, deleted: null }, {
            $set: entry
        }, {
            upsert: true
        });
        if (result) {
            return entry;
        } else {
            throw new GraphQLError('Database error', { extensions: { code: errorCodes.DATABASE_ERROR } });
        }
    }

    public async deleteOrganisation(requester: IUserWithoutToken | undefined, id: string) {
        if (!requester) {
            throw new GraphQLError(errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);
        }
        /* check privileges */
        if (requester.type !== enumUserTypes.ADMIN) {
            throw new GraphQLError(errorCodes.NO_PERMISSION_ERROR);
        }

        const res = await this.db.collections.organisations_collection.findOneAndUpdate({ id: id }, {
            $set: {
                deleted: Date.now()
            }
        }, {
            returnDocument: 'after'
        });

        if (res) {
            return res;
        } else {
            throw new GraphQLError('Delete organisation failed.');
        }
    }
}
