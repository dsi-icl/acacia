import { createRef, FunctionComponent, useState } from 'react';
import { Mutation, Query } from '@apollo/client/react/components';
import { NavLink } from 'react-router-dom';
import { CREATE_FIELD_CURATION_JOB, GET_STUDY } from '@itmat-broker/itmat-models';
import { IFile } from '@itmat-broker/itmat-types';
import LoadSpinner from '../../../reusable/loadSpinner';
import css from './tabContent.module.css';
import { Button, Select } from 'antd';
const { Option } = Select;

export const UploadNewFields: FunctionComponent<{ studyId: string }> = ({ studyId }) => {
    const [expanded, setExpanded] = useState(false);
    const [error, setError] = useState('');
    const [uploadFileTabSelected, setUploadFileTabSelected] = useState(true);
    const fileRef = createRef();

    if (!expanded) {
        return <Button onClick={() => setExpanded(true)}>Upload new annotations</Button>;
    }

    return <div className={css.add_new_fields_section}>
        <p>Please note that you will need to upload an entire set of annotations and not just the delta.</p>
        <p>You can either upload a new annotation files or select one previously uploaded file:</p>
        <h5 onClick={() => setUploadFileTabSelected(true)} className={uploadFileTabSelected ? css.selected_tab : ''}>Upload a new file</h5><h5 onClick={() => setUploadFileTabSelected(false)} className={!uploadFileTabSelected ? css.selected_tab : ''}>Select from existing file</h5>
        {
            uploadFileTabSelected ?
                <>
                    <br />
                    <input title='file' type='file' ref={fileRef as any} />
                    <Mutation<any, any> mutation={CREATE_FIELD_CURATION_JOB}>
                        {(createCurationJob, { loading }) => {
                            if (loading) { return <button>Loading...</button>; }
                            return (
                                <button onClick={() => {
                                    if ((fileRef.current as any).files.length === 1) {
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
                <UploadFieldBySelectingFileFormFetch {...{ studyId, cancel: setExpanded }} />
        }
    </div>;
};


const UploadFieldBySelectingFileFormFetch: FunctionComponent<{ studyId: string; cancel: (__unused__expanded: boolean) => void }> = ({ studyId, cancel }) => {
    return <Query<any, any> query={GET_STUDY} variables={{ studyId }}>
        {({ loading, data, error }) => {
            if (loading) return <LoadSpinner />;
            if (error) return <p>{error.toString()}</p>;
            if (!data.getStudy || data.getStudy.files === undefined || data.getStudy.files.length === 0) {
                return <p>No file has been uploaded to this dataset yet. You can do this in the <NavLink to={`/datasets/${studyId}/files`}><span style={{ color: 'var(--color-primary-color)', textDecoration: 'underline' }}>file repository</span></NavLink></p>;
            }
            return <UploadFieldBySelectingFileForm files={data.getStudy.files} studyId={studyId} cancel={cancel} />;
        }}
    </Query>;
};

const UploadFieldBySelectingFileForm: FunctionComponent<{ studyId: string; files: IFile[]; cancel: (__unused__expanded: boolean) => void }> = ({ cancel, studyId, files }) => {
    const [error, setError] = useState('');
    const [successfullySaved, setSuccessfullySaved] = useState(false);
    const [selectedFile, setSelectedFile] = useState(''); // files.length > 0 because of checks above
    const [tag, setTag] = useState('');

    return <div>
        <label>Data file:</label>
        <Select style={{ width: '50%' }} value={selectedFile} onChange={(value) => { setSuccessfullySaved(false); setSelectedFile(value); setError(''); }}>{files.filter(el => el.fileName.indexOf('VariablesList') >= 0).map((el: IFile) => <Option key={el.id} value={el.id}>{el.fileName}</Option>)}</Select><br /><br />
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
                            tag
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
