import gql from 'graphql-tag';

export const UPLOAD_FILE = gql`
    mutation uploadFile($studyId: String!, $file: Upload!, $description: String!, $fileLength: Int) {
        uploadFile(studyId: $studyId, description: $description, file: $file, fileLength: $fileLength) {
            id
            fileName
            studyId
            projectId
            fileSize
            description
            uploadedBy
        }
    }
`;

export const DELETE_FILE = gql`
    mutation deleteFile($fileId: String!) {
        deleteFile(fileId: $fileId) {
            successful
        }
    }
`;
