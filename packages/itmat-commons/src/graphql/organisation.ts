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
    mutation createOrganisation($name: String!, $shortname: String, $containOrg: String) {
        createOrganisation(name: $name, shortname: $shortname, containOrg: $containOrg) {
            id            
            name
            shortname
            containOrg
        }
    }
`;
