import gql from 'graphql-tag';

export const WRITE_LOG = gql`
    mutation WriteLog(
        $requesterId: String
        $requesterName: String
        $requesterType: USERTYPE
        $action: LOG_ACTION!
        $actionData: JSON
        $status: LOG_STATUS
    ) {
        writeLog(
            requesterId: $requesterId, 
            requesterName: $requesterName,
            requesterType: $requesterType,
            action: $action,
            actionData: $actionData,
            status:$status
        ) {
            id,
            requesterId,
            requesterName,
            requesterType,
            action
            actionData
            time
            status
        }
    }
`;

export const GET_LOGS = gql`
    query getLogs(
        $requesterId: String,
        $requesterName: String, 
        $requesterType: USERTYPE,
        $action: LOG_ACTION,
        $status: LOG_STATUS 
    ) {
        getLogs (
            requesterId: $requesterId,
            requesterName: $requesterName,
            requesterType: $requesterType,
            action: $action
            status: $status
        ) {
            id,
            requesterId,
            requesterName,
            requesterType,
            action,
            actionData,
            time,
            status
        }
    }
`;
