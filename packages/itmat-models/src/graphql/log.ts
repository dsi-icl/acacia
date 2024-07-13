import gql from 'graphql-tag';

export const GET_LOGS = gql`
    query getLogs(
        $requesterName: String, 
        $requesterType: String,
        $logType: String,
        $actionType: String,
        $status: String 
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
