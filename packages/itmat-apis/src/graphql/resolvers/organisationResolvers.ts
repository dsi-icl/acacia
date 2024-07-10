import { TRPCOrganisationCore } from '@itmat-broker/itmat-cores';
import { DMPResolversMap } from './context';


export class OrganisationResolvers {
    organisationCore: TRPCOrganisationCore;
    constructor(organisationCore: TRPCOrganisationCore) {
        this.organisationCore = organisationCore;
    }


    async getOrganisations(_parent, args: { organisationId?: string }) {
        return await this.organisationCore.getOrganisations(undefined, args.organisationId);
    }


    async createOrganisation(parent, { name, shortname }: { name: string, shortname: string, containOrg: string, metadata: unknown }, context) {
        return await this.organisationCore.createOrganisation(context.req.user, name, shortname);
    }
    async deleteOrganisation(parent, { id }: { id: string }, context) {
        return await this.organisationCore.deleteOrganisation(context.req.user, id);
    }

    getResolvers(): DMPResolversMap {
        return {
            Query: {
                getOrganisations: this.getOrganisations.bind(this)
            },
            Mutation: {
                createOrganisation: this.createOrganisation.bind(this),
                deleteOrganisation: this.deleteOrganisation.bind(this)
            }
        };
    }
}
