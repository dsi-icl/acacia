import React from 'react';
import { Mutation, Query } from '@apollo/client/react/components';
import { NavLink } from 'react-router-dom';
import { CREATE_FIELD_CURATION_JOB, GET_STUDY, IFile } from 'itmat-commons';
import { LoadingBalls } from '../../../reusable/icons/loadingBalls';
import css from './tabContent.module.css';

export const UploadNewFields: React.FunctionComponent<{ studyId: string; dataVersionId: string }> = ({ studyId, dataVersionId }) => {
    const [expanded, setExpanded] = React.useState(false);
    const [error, setError] = React.useState('');
    const [uploadFileTabSelected, setUploadFileTabSelected] = React.useState(true);
    const fileRef = React.createRef();
    console.log(dataVersionId);
    if (!expanded) {
        return <button onClick={() => setExpanded(true)}>Upload new annotations</button>;
    }

    return <>
        <div className={css.add_new_fields_section}>
            <p>Please note that you will need to upload an entire set of annotations and not just the delta.</p>
            <p>You can either upload a new annotation files or select one previously uploaded file:</p>
            <h5 onClick={() => setUploadFileTabSelected(true)} className={uploadFileTabSelected ? css.selected_tab : ''}>Upload a new file</h5><h5 onClick={() => setUploadFileTabSelected(false)} className={!uploadFileTabSelected ? css.selected_tab : ''}>Select from existing file</h5>
            {
                uploadFileTabSelected ?
                    <>
                        <br />
                        <input type='file' ref={fileRef as any} />
                        <Mutation<any, any> mutation={CREATE_FIELD_CURATION_JOB}>
                            {(createCurationJob, { loading }) => {
                                if (loading) { return <button>Loading...</button>; }
                                return (
                                    <button onClick={() => {
                                        if ((fileRef.current as any).files.length === 1) {
                                            console.log((fileRef.current as any).files[0], typeof (fileRef.current as any).files[0]);
                                            setError('');
                                            createCurationJob({
                                                variables: {
                                                }
                                            });
                                        } else {
                                            setError('Please select file.');
                                        }
                                    }}>NOT IMPLEMENTED</button>
                                );
                            }}
                        </Mutation>
                        <button onClick={() => setExpanded(false)} className='button_grey'>Cancel</button>
                        {error ? <div className='error_banner'>{error}</div> : null}
                    </>
                    :
                    <UploadFieldBySelectingFileFormFetch {...{ studyId, dataVersionId, cancel: setExpanded }} />
            }
        </div>
    </>;
};


const UploadFieldBySelectingFileFormFetch: React.FunctionComponent<{ studyId: string; dataVersionId: string; cancel: (expanded: boolean) => void }> = ({ dataVersionId, studyId, cancel }) => {
    return <Query<any, any> query={GET_STUDY} variables={{ studyId }}>
        {({ loading, data, error }) => {
            if (loading) return <LoadingBalls />;
            if (error) return <p>{error.toString()}</p>;
            if (!data.getStudy || data.getStudy.files === undefined || data.getStudy.files.length === 0) {
                return <p>No file has been uploaded to this dataset yet. You can do this in the <NavLink to={`/datasets/${studyId}/files`}><span style={{ color: 'var(--color-primary-color)', textDecoration: 'underline' }}>file repository</span></NavLink></p>;
            }
            return <UploadFieldBySelectingFileForm dataVersionId={dataVersionId} files={data.getStudy.files} studyId={studyId} cancel={cancel} />;
        }}
    </Query>;
};

const UploadFieldBySelectingFileForm: React.FunctionComponent<{ studyId: string; files: IFile[]; dataVersionId: string; cancel: (expanded: boolean) => void }> = ({ cancel, dataVersionId, studyId, files }) => {
    const [error, setError] = React.useState('');
    const [successfullySaved, setSuccessfullySaved] = React.useState(false);
    const [selectedFile, setSelectedFile] = React.useState(files[files.length - 1].id); // files.length > 0 because of checks above
    const [tag, setTag] = React.useState('');

    return <div>
        <label>Data file:</label>
        <select value={selectedFile} onChange={(e) => { setSuccessfullySaved(false); setSelectedFile(e.target.value); setError(''); }}>{files.map((el: IFile) => <option key={el.id} value={el.id}>{el.fileName}</option>)}</select><br /><br />
        <label>Tag:</label>
        <input value={tag} onChange={(e) => { setTag(e.target.value); setError(''); setSuccessfullySaved(false); }} placeholder='e.g main tree' type='text' /><br /><br />
        <Mutation<any, any> mutation={CREATE_FIELD_CURATION_JOB} onCompleted={() => setSuccessfullySaved(true)}>
            {(createCurationJob, { loading }) => {
                if (loading) { return <button style={{ width: '45%', display: 'inline-block' }}>Loading..</button>; }
                return <button style={{ width: '45%', display: 'inline-block' }} onClick={() => {
                    if (!selectedFile) {
                        setError('Please select a file.');
                        setSuccessfullySaved(false);
                        return;
                    }
                    if (!tag) {
                        setError('Tag cannot be empty.');
                        setSuccessfullySaved(false);
                        return;
                    }

                    createCurationJob({
                        variables: {
                            file: selectedFile,
                            studyId,
                            tag,
                            dataVersionId
                        }
                    });

                }}>Submit</button>;
            }}
        </Mutation>
        <button style={{ width: '45%', display: 'inline-block' }} className='button_grey' onClick={() => cancel(false)}>Cancel</button>

        {error ? <div className='error_banner'>{error}</div> : null}
        {successfullySaved ? <div className='saved_banner'>Job created and queued.</div> : null}
    </div>;
};
