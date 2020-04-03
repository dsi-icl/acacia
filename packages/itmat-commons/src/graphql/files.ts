import { gql } from '@apollo/client';

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
