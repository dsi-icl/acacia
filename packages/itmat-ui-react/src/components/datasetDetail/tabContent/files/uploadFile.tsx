import React from 'react';
import { useApolloClient, useMutation } from 'react-apollo';
import { Models, GQLRequests } from 'itmat-commons';
const {
    UPLOAD_FILE,
    GET_STUDY
} = GQLRequests;
const { STUDY_REPO_FILE, STUDY_REPO_DIR } = Models.File.fileType;

export const UploadFileSection: React.FunctionComponent<{ studyId: string }> = ({ studyId }) => {
    const [description, setDescription] = React.useState('');
    const [error, setError] = React.useState('');
    const [success, setSuccess] = React.useState(false);
    const fileRef = React.createRef();
    const store = useApolloClient();
    const [uploadFile, { loading }] = useMutation(UPLOAD_FILE, {
        onCompleted: ({ uploadFile }) => {
            setDescription('');
            setError('');
            setSuccess(true);
            const cachedata = store.readQuery({ query: GET_STUDY, variables: { studyId } }) as any;
            if (!cachedata) { return; }
            const newcachedata = { ...cachedata.getStudy, files: [...cachedata.getStudy.files, uploadFile] };
            store.writeQuery({ query: GET_STUDY, variables: { studyId }, data: { getStudy: newcachedata } });
        }
    });

    return <div>
        <label>Select file: <input type="file" ref={fileRef as any} /></label><br /><br />
        <label>Description: <input type="text" value={description} onChange={(e) => { setDescription(e.target.value); setError(''); setSuccess(false); }} /></label>
        <br /><br /><br />
        {
            loading ? <button>Loading...</button> :
                <button onClick={() => {
                    if ((fileRef.current! as any).files.length === 0) {
                        setError('You must select a file.');
                        setSuccess(false);
                        return;
                    }

                    if (description === '') {
                        setError('You must provide description.');
                        setSuccess(false);
                        return;
                    }

                    const file: File = (fileRef.current! as any).files[0];
                    const isZipped = file.name.substring(file.name.lastIndexOf('.') + 1) === 'zip';
                    uploadFile({ variables: {
                        file,
                        studyId,
                        description,
                        fileLength: file.size,
                        fileType: isZipped ? STUDY_REPO_DIR : STUDY_REPO_FILE,
                        isZipped
                    } });
                }}>Upload</button>
        }
        {error ? <div className="error_banner">{error}</div> : null}
        {success ? <div className="saved_banner">Uploaded.</div> : null}
    </div>;
};
