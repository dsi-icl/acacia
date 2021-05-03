import gql from 'graphql-tag';
import { job_fragment } from './curation';

export const DELETE_STUDY = gql`
    mutation deleteStudy($studyId: String!) {
        deleteStudy(studyId: $studyId) {
            id
            successful
        }
    }
`;

export const GET_STUDY = gql`
    query getStudy($studyId: String!) {
        getStudy(studyId: $studyId) {
            id
            name
            createdBy
            description
            type
            jobs {
                ...ALL_FOR_JOB
            }
            projects {
                id
                studyId
                name
            }
            roles {
                id
                name
                permissions
                projectId
                studyId
                users {
                    id
                    firstname
                    lastname
                    organisation
                    username
                }
            }
            files {
                id
                fileName
                studyId
                projectId
                fileSize
                description
                uploadTime
                uploadedBy
                hash
            }
            numOfSubjects
            currentDataVersion
            dataVersions {
                id
                version
                tag
                updateDate
                jobId
                extractedFrom
                contentId
                fieldTrees
            }
        }
    }
    ${job_fragment}
`;

export const GET_DATA_RECORDS = gql`
    query getDataRecords($studyId: String!, $queryString: JSON, $versionId: [String], $projectId: String) {
        getDataRecords(studyId: $studyId, queryString: $queryString, versionId: $versionId, projectId: $projectId)
    }
`;

export const CREATE_STUDY = gql`
    mutation createStudy($name: String!, $description: String, $type: STUDYTYPE!){
        createStudy(name: $name, description: $description, type: $type) {
            id
            name
            description
            type
        }
    }
`;

export const EDIT_STUDY = gql`
    mutation editStudy($studyId: String!, $description: String) {
        editStudy(studyId: $studyId, description: $description) {
            id
            name
            description
            type
        }
    }
`;

export const CREATE_NEW_DATA_VERSION = gql`
    mutation createNewDataVersion($fieldTreeId: String!, $studyId: String!, $dataVersion: String!, $tag: String){
        createNewDataVersion(fieldTreeId: $fieldTreeId, studyId: $studyId, dataVersion: $dataVersion, tag: $tag) {
            id
            version
            tag
            updateDate
            jobId
            extractedFrom
            contentId
            fieldTrees
        }
    }
`;

export const UPLOAD_DATA_IN_ARRAY = gql`
    mutation uploadDataInArray($studyId: String!, $fieldTreeId: String!, $data: [DataClip]) {
        uploadDataInArray(studyId: $studyId, fieldTreeId: $fieldTreeId, data: $data) {
            detail
            numOfRecordSucceed
            numOfRecordFailed
        }
    }
`;

export const DELETE_DATA_RECORDS = gql`
    mutation deleteDataRecords($studyId: String!, $subjectId: String, $versionId: String, $visitId: Int, $fieldIds: [String]) {
        deleteDataRecords(studyId: $studyId, subjectId: $subjectId, versionId: $versionId, visitId: $visitId, fieldIds: $fieldIds) {
            detail
            numOfRecordSucceed
            numOfRecordFailed
        }
    }
`;

export const RECOVER_DATA_RECORDS = gql`
    mutation recoverDataRecords($studyId: String!, $subjectId: String, $versionId: String, $visitId: Int) {
        recoverDataRecords(studyId: $studyId, subjectId: $subjectId, versionId: $versionId, visitId: $visitId) {
            detail
            numOfRecordSucceed
            numOfRecordFailed
        }
    }
`;

export const CREATE_PROJECT = gql`
    mutation createProject($studyId: String!, $projectName: String!, $approvedFields: [String]) {
        createProject(studyId: $studyId, projectName: $projectName, approvedFields: $approvedFields) {
            id
            studyId
            name
            approvedFields
        }
    }
`;

export const DELETE_PROJECT = gql`
    mutation deleteProject($projectId: String!) {
        deleteProject(projectId: $projectId) {
            id
            successful
        }
    }
`;

export const SET_DATAVERSION_AS_CURRENT = gql`
    mutation setDataversionAsCurrent($studyId: String!, $dataVersionId: String!) {
        setDataversionAsCurrent(studyId: $studyId, dataVersionId: $dataVersionId) {
            id
            currentDataVersion
            dataVersions {
                id
                version
                tag
                updateDate
                jobId
                extractedFrom
                contentId
                fieldTrees
            }
        }
    }
`;
