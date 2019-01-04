import gql from "graphql-tag";

export const GET_STUDIES = gql`
    query getStudies($name: String){
        getStudies(name: $name) {
            name
            studyAndDataManagers
            applications {
                name
                pendingUserApprovals {
                    user
                    type
                }
                applicationAdmins
                applicationUsers
                approvedFields
            }
            createdBy
        }
    }
`;