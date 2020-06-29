import gql from 'graphql-tag';

export const WRITE_LOG = gql`
    mutation WriteLog(
        $requesterId: String!
        $requesterName: String!
        $requesterType: USERTYPE!
        $action: LOG_ACTION!
        $actionData: JSON
    ) {
        writeLog(
            requesterId: $requesterId, 
            requesterName: $requesterName,
            requesterType: $requesterType,
            action: $action,
            actionData: $actionData
        ) {
            id,
            requesterId,
            requesterName,
            requesterType,
            action
            actionData
            time
        }
    }
`;

export const GET_LOGS = gql`
    query getLogs(
        $requesterId: String,
        $requesterName: String, 
        $requesterType: USERTYPE,
        $action: LOG_ACTION 
    ) {
        getLogs (
            requesterId: $requesterId,
            requesterName: $requesterName,
            requesterType: $requesterType,
            action: $action
        ) {
            id,
            requesterId,
            requesterName,
            requesterType,
            action,
            actionData
            time
        }
    }
`;