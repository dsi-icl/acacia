import React from 'react';
import { useApolloClient, useMutation } from 'react-apollo';
import { UPLOAD_FILE } from '../../../../graphql/files';
import { GET_STUDY } from '../../../../graphql/study';

export const UploadFileSection: React.FunctionComponent<{ studyId: string }> = ({ studyId }) => {
    const [description, setDescription] = React.useState('');
    const [error, setError] = React.useState('');
    const [success, setSuccess] = React.useState(false);
    const fileRef = React.createRef();
    const store = useApolloClient();
    const [uploadFile, { loading, error: Graphqlerror }] = useMutation(UPLOAD_FILE, {
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
        <label>Select file: </label><input type="file" ref={fileRef as any}/><br/><br/>
        <label>Description: </label><input type="text" value={description} onChange={(e) => { setDescription(e.target.value); setError(''); setSuccess(false); }}/>
        <br/><br/><br/>
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

                                const file = (fileRef.current! as any).files[0];
                                uploadFile({ variables: { file, studyId, description, fileLength: file.size }});
                            }}>Upload</button>
        }
        { error ? <div className="error_banner">{error}</div> : null }
        { success ? <div className="saved_banner">Uploaded.</div> : null }
    </div>;
};
