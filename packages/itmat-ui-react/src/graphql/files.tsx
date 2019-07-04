import gql from "graphql-tag";

export const UPLOAD_FILE = gql`
    mutation uploadFile($studyId: String!, $projectId: String, $file: Upload!, $description: String!) {
        uploadFile(studyId: $studyId, projectId: $projectId, description: $description, file: $file) {
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