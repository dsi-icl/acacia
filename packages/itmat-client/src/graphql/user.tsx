import gql from "graphql-tag";

export const LOGIN = gql`
    mutation Login($username: String!, $password: String!) {
        login(username: $username, password: $password) {
            id
            username
            type
            realName
            shortcuts {
                id
                application
                study
            }
            email
            emailNotificationsActivated
            createdBy
        }
    }
`;

export const LOGOUT = gql`
    mutation {
        logout{
            successful
            id
        }
    }
`;

export const WHO_AM_I = gql`
    {
        whoAmI {
            id
            username
            type
            realName
            shortcuts {
                id
                application
                study
            }
            email
            emailNotificationsActivated
            createdBy
        }
    }
`;

export const SHORTCUTS_LIST = gql`
    {
        whoAmI {
            id
            shortcuts {
                id
                application
                study
            }
        }
    }
`;

export const ADD_SHORT_CUT = gql`
    mutation addShortCut($study: String!, $application: String) {
        addShortCut(study: $study, application: $application) {
            id
            shortcuts {
                id
                application
                study
            }
        }
    }
`;

export const REMOVE_SHORT_CUT = gql`
    mutation removeShortCut($shortCutId: String!) {
        removeShortCut(shortCutId: $shortCutId) {
            id
            shortcuts {
                id
                application
                study
            }
        }
    }
`;