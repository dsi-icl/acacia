import gql from 'graphql-tag';

export const UPLOAD_FILE = gql`
    mutation uploadFile($studyId: String!, $file: Upload!, $description: String!, $fileLength: BigInt, $hash: String) {
        uploadFile(studyId: $studyId, description: $description, file: $file, fileLength: $fileLength, hash: $hash) {
            id
            uri
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
    }
`;

export const DELETE_FILE = gql`
    mutation deleteFile($fileId: String!) {
        deleteFile(fileId: $fileId) {
            successful
        }
    }
`;
