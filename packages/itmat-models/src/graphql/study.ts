import gql from 'graphql-tag';
import { JOB_FRAGMENT } from './curation';

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
                description
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
                metadata
            }
            subjects
            visits
            numOfRecords
            currentDataVersion
            dataVersions {
                id
                version
                tag
                updateDate
                contentId
            }
        }
    }
    ${JOB_FRAGMENT}
`;

export const GET_DATA_RECORDS = gql`
    query getDataRecords($studyId: String!, $queryString: JSON, $versionId: String, $projectId: String) {
        getDataRecords(studyId: $studyId, queryString: $queryString, versionId: $versionId, projectId: $projectId)
    }
`;

export const GET_ONTOLOGY_TREE = gql`
    query getOntologyTree($studyId: String!, $projectId: String, $treeName: String, $versionId: String) {
        getOntologyTree(studyId: $studyId, projectId: $projectId, treeName: $treeName, versionId: $versionId) {
            id
            name
            routes {
                id
                path
                name
                field
                visitRange
            }
            metadata
        }
    }
`;

export const CHECK_DATA_COMPLETE = gql`
    query checkDataComplete($studyId: String!) {
        checkDataComplete(studyId: $studyId) {
            subjectId
            visitId
            fieldId
            error
        }
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
    mutation createNewDataVersion($studyId: String!, $dataVersion: String!, $tag: String){
        createNewDataVersion(studyId: $studyId, dataVersion: $dataVersion, tag: $tag) {
            id
            version
            tag
            updateDate
            contentId
        }
    }
`;

export const UPLOAD_DATA_IN_ARRAY = gql`
    mutation uploadDataInArray($studyId: String!, $data: [DataClip]) {
        uploadDataInArray(studyId: $studyId, data: $data) {
            successful
            id
            code
            description
        }
    }
`;

export const DELETE_DATA_RECORDS = gql`
    mutation deleteDataRecords($studyId: String!, $subjectIds: [String], $visitIds: [String], $fieldIds: [String]) {
        deleteDataRecords(studyId: $studyId, subjectIds: $subjectIds, visitIds: $visitIds, fieldIds: $fieldIds) {
            successful
            id
            code
            description
        }
    }
`;

export const CREATE_ONTOLOGY_TREE = gql`
    mutation createOntologyTree($studyId: String!, $ontologyTree: OntologyTreeInput!) {
        createOntologyTree(studyId: $studyId, ontologyTree: $ontologyTree) {
            id
            name
            routes {
                id
                path
                name
                field
                visitRange
            }
            metadata
        }
    }
`;

export const DELETE_ONTOLOGY_TREE = gql`
    mutation deleteOntologyTree($studyId: String!, $treeName: String!) {
        deleteOntologyTree(studyId: $studyId, treeName: $treeName) {
            id
            successful
        }
    }
`;

export const CREATE_PROJECT = gql`
    mutation createProject($studyId: String!, $projectName: String!) {
        createProject(studyId: $studyId, projectName: $projectName) {
            id
            studyId
            name
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
                contentId
            }
        }
    }
`;
