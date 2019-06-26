import gql from "graphql-tag";

export const CREATE_CURATION_JOB = gql`
    mutation createCurationJob($file: Upload!, $studyId: String!, $jobType: CURATION_JOB_TYPE) {
        createCurationJob(file: $file, studyId: $studyId, jobType: $jobType) {
            id
            studyId
            projectId
            jobType
            requester
            receivedFiles
            status
            error
            cancelled
            cancelledTime
            data
        }
    }
`; 