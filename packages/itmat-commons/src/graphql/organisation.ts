import gql from 'graphql-tag';

export const GET_ORGANISATIONS = gql`
    query getOrganisations($organisationId: String) {
        getOrganisations(organisationId: $organisationId) {
            id
            name
            shortname
            containOrg
            deleted
            metadata {
                siteIDMarker
            }
        }
    }
`;

export const CREATE_ORGANISATION = gql`
    mutation createOrganisation($name: String!, $shortname: String, $containOrg: String, $metadata: OrganisationMetadataInput) {
        createOrganisation(name: $name, shortname: $shortname, containOrg: $containOrg, metadata: $metadata) {
            id            
            name
            shortname
            containOrg
            metadata {
                siteIDMarker
            }
        }
    }
`;

export const DELETE_ORGANISATION = gql`
    mutation deleteOrganisation($id: String!) {
        deleteOrganisation(id: $id) {
            id            
            name
            shortname
            containOrg
            metadata {
                siteIDMarker
            }
        }
    }
`;
