const { print } = require('graphql');
const gql = require('graphql-tag');

const WHO_AM_I = print(gql`
{
    whoAmI {
        id
        username
        type
        realName
        shortcuts {
            id
            project
            study
        }
        email
        emailNotificationsActivated
        createdBy
    }
}
`);

const ADD_SHORT_CUT = print(gql`
    mutation addShortCut($study: String!, $project: String) {
        addShortCut(study: $study, project: $project) {
            id
            username
            shortcuts {
                id
                application
                study
            }
        }
    }
`);

const REMOVE_SHORT_CUT = print(gql`
    mutation removeShortCut($shortCutId: String!) {
        removeShortCut(shortCutId: $shortCutId) {
            id
            username
            shortcuts {
                id
                application
                study
            }
        }
    }
`);

module.exports = { WHO_AM_I, ADD_SHORT_CUT, REMOVE_SHORT_CUT };