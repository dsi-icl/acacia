import gql from 'graphql-tag';

const file_fragment_without_children = gql`
    fragment FILE_WITHOUT_CHILDREN on File {
        id
        fileName
        studyId
        projectId
        fileType
        fileSize
        content
        description
        uploadedBy
        userId
        dataVersionId
        patientId
    }
`;

export const CREATE_FILE = gql`
    mutation createFile(
        $fileName: String!,
        $fileType: FileType,
        $studyId: String
    ) {
        createFile(
            fileName: $fileName,
            fileType: $fileType,
            studyId: $studyId
        ) {
            ...FILE_WITHOUT_CHILDREN 
        }
    }
    ${file_fragment_without_children}
`;

export const UPLOAD_FILE = gql`
    mutation uploadFile($studyId: String!, $file: Upload!, $description: String, $fileLength: Int, $fileType: FileType) {
        uploadFile(studyId: $studyId, description: $description, file: $file, fileLength: $fileLength, fileType: $fileType) {
            ...FILE_WITHOUT_CHILDREN 
        }
    }
    ${file_fragment_without_children}
`;

export const DELETE_FILE = gql`
    mutation deleteFile($fileId: String!) {
        deleteFile(fileId: $fileId) {
            successful
        }
    }
`;

export const GET_FILE_WITHOUT_CHILDREN = gql`
    query getFileWithoutChildren($fileId: String!) {
        getFile(fileId: $fileId) {
            ...FILE_WITHOUT_CHILDREN 
        }
    }
    ${file_fragment_without_children}
`;

export const FETCH_CHILD_FILES = gql`
    query fetchChildFiles($dirFileId: String!) {
        getFile(fileId: $dirFileId) {
            id
            childFiles {
                ...FILE_WITHOUT_CHILDREN 
            }
        }
    }
    ${file_fragment_without_children}
`;

export const CREATE_JOB_FOR_UNZIPPING_FILE = gql`
    mutation createJobForUnzippingFile($fileId: String!) {
        successful
    }
`;
