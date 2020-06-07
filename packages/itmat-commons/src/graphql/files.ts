import gql from 'graphql-tag';

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
            id
            fileName
            studyId
            projectId
            fileType
            fileSize
            description
            uploadedBy
            userId
            patientId
            # childFiles
        }
    }
`;

export const UPLOAD_FILE = gql`
    mutation uploadFile($studyId: String!, $file: Upload!, $description: String!, $fileLength: Int) {
        uploadFile(studyId: $studyId, description: $description, file: $file, fileLength: $fileLength) {
            id
            fileName
            studyId
            fileType
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