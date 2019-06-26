import React from 'react';
import * as css from './tabContent.module.css';
import { Mutation } from 'react-apollo';
import { CREATE_CURATION_JOB } from '../../../../graphql/curation';

export const UploadNewFields: React.FunctionComponent<{ studyId: string }> = ({ studyId }) => {
    const [expanded, setExpanded] = React.useState(false);
    const [error, setError] = React.useState('');
    const [uploadFileTabSelected, setUploadFileTabSelected] = React.useState(true);
    const fileRef = React.createRef();

    if (!expanded) {
        return <button onClick={() => setExpanded(true)}>Upload new annotations</button>
    }

    return <>
        <div className={css.add_new_fields_section}>
            <p>Please note that you will need to upload an entire set of annotations and not just the delta.</p>
            <p>You can either upload a new annotation files or select one previously uploaded file:</p>
            <h5 onClick={() => setUploadFileTabSelected(true)} className={uploadFileTabSelected ? css.selected_tab : ''}>Upload a new file</h5><h5 onClick={() => setUploadFileTabSelected(false)} className={!uploadFileTabSelected ? css.selected_tab : ''}>Select from existing file</h5>
            {
                uploadFileTabSelected ? 
                <>
                    <br/>
                    <input type='file' ref={fileRef as any}/>
                    <Mutation mutation={CREATE_CURATION_JOB}>
                        {(createCurationJob, { loading }) => {
                            if (loading) return <button>Loading...</button>;
                            return (
                                <button onClick={() => {
                                    if ((fileRef.current as any).files.length === 1) {
                                        console.log((fileRef.current as any).files[0], typeof (fileRef.current as any).files[0]);
                                        setError('');
                                        createCurationJob({ variables: {
                                            file: (fileRef.current as any).files[0],
                                            studyId,
                                            jobType: 'FIELD_INFO_UPLOAD'
                                        }});
                                    } else {
                                        setError('Please select file.');
                                    }
                                }}>Upload</button>
                            );
                        }}
                    </Mutation>
                    <button onClick={() => setExpanded(false)} className='button_grey'>Cancel</button>
                    { error ? <div className='error_banner'>{error}</div> : null }
                </>
                :
                <>
                    <button>Upload</button><button onClick={() => setExpanded(false)} className='button_grey'>Cancel</button>
                </>
            }

        </div>
    </>;
};