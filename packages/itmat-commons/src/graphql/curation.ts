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
    mutation createDataCurationJob($file: String!, $studyId: String!, $tag: String, $version: String!) {
        createDataCurationJob(file: $file, studyId: $studyId, tag: $tag, version: $version) {
            ...ALL_FOR_JOB
        }
    }
    ${JOB_FRAGMENT}
`;

export const CREATE_FIELD_CURATION_JOB = gql`
    mutation createDataCurationJob($file: String!, $studyId: String!, $tag: String!, $dataVersionId: String!) {
        createFieldCurationJob(file: $file, studyId: $studyId, tag: $tag, dataVersionId: $dataVersionId) {
            ...ALL_FOR_JOB
        }
    }
    ${JOB_FRAGMENT}
`;
