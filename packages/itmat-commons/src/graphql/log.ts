import gql from 'graphql-tag';

export const GET_LOGS = gql`
    query getLogs(
        $requesterName: String, 
        $requesterType: USERTYPE,
        $logType: LOG_TYPE,
        $actionType: LOG_ACTION,
        $status: LOG_STATUS 
    ) {
        getLogs (
            requesterName: $requesterName,
            requesterType: $requesterType,
            logType: $logType,
            actionType: $actionType,
            status: $status
        ) {
            id,
            requesterName,
            requesterType,
            userAgent,
            logType,
            actionType,
            actionData,
            time,
            status,
            error
        }
    }
`;
