export type OrganisationMetadata = {
    siteIDMarker?: string;
}

export interface IOrganisation {
    id: string;
    name: string;
    shortname: string | null;
    containOrg: string | null;
    deleted: number | null;
    metadata: OrganisationMetadata;
}
