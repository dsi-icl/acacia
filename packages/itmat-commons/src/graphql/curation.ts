import gql from 'graphql-tag';

export const JOB_FRAGMENT = gql`
    fragment ALL_FOR_JOB on Job {
        id
        studyId
        projectId
        jobType
        requester
        requestTime
        receivedFiles
        status
        error
        cancelled
        cancelledTime
        data
    }
`;

export const CREATE_DATA_CURATION_JOB = gql`
    mutation createDataCurationJob($file: [String]!, $studyId: String!) {
        createDataCurationJob(file: $file, studyId: $studyId) {
            ...ALL_FOR_JOB
        }
    }
    ${JOB_FRAGMENT}
`;

export const CREATE_FIELD_CURATION_JOB = gql`
    mutation createFieldCurationJob($file: String!, $studyId: String!, $tag: String!) {
        createFieldCurationJob(file: $file, studyId: $studyId, tag: $tag) {
            ...ALL_FOR_JOB
        }
    }
    ${JOB_FRAGMENT}
`;

export const CREATE_QUERY_CURATION_JOB = gql`
    mutation createQueryCurationJob($queryId: [String], $studyId: String, $projectId: String) {
        createQueryCurationJob(queryId: $queryId, studyId: $studyId, projectId: $projectId) {
            ...ALL_FOR_JOB
        }
    }
    ${JOB_FRAGMENT}
`;
