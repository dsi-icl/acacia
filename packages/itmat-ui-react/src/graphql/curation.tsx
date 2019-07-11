import gql from "graphql-tag";

export const CREATE_CURATION_JOB = gql`
    mutation createCurationJob($file: String!, $studyId: String!, $jobType: CURATION_JOB_TYPE!, $tag: String, $version: String!) {
        createCurationJob(file: $file, studyId: $studyId, jobType: $jobType, tag: $tag, version: $version) {
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