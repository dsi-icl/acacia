import React from 'react';
import { Mutation, Query } from '@apollo/client/react/components';
import { NavLink } from 'react-router-dom';
import { CREATE_DATA_CURATION_JOB, GET_STUDY, IFile } from 'itmat-commons';
import { LoadingBalls } from '../../../reusable/icons/loadingBalls';

export const UploadNewData: React.FunctionComponent<{ studyId: string; cancelButton: (shown: boolean) => void }> = ({ studyId, cancelButton }) => {
    return <div>
        <p>To upload a new version of the dataset, please make sure you have <NavLink to={`/datasets/${studyId}/files`}><span style={{ color: 'var(--color-primary-color)', textDecoration: 'underline' }}>uploaded the data file to the file repository</span></NavLink>.</p>
        <br /><br />

        <Query<any, any> query={GET_STUDY} variables={{ studyId }}>
            {({ loading, data, error }) => {
                if (loading) { return <LoadingBalls />; }
                if (error) { return <p>{error.toString()}</p>; }
                if (!data.getStudy || data.getStudy.files === undefined || data.getStudy.files.length === 0) {
                    return null;
                }
                return <UploadNewDataForm cancelButton={cancelButton} studyId={studyId} files={data.getStudy.files} />;
            }}
        </Query>

    </div>;
};

const UploadNewDataForm: React.FunctionComponent<{ studyId: string; files: IFile[]; cancelButton: (shown: boolean) => void }> = ({ cancelButton, files, studyId }) => {
    const [error, setError] = React.useState('');
    const [successfullySaved, setSuccessfullySaved] = React.useState(false);
    const [selectedFile, setSelectedFile] = React.useState(files[files.length - 1].id); // files.length > 0 because of checks above
    const [versionNumber, setVersionNumber] = React.useState('');
    const [tag, setTag] = React.useState('');

    return <>
        <label>Data file:</label>
        <select value={selectedFile} onChange={(e) => { setSuccessfullySaved(false); setSelectedFile(e.target.value); setError(''); }}>{files.map((el: IFile) => <option key={el.id} value={el.id}>{el.fileName}</option>)}</select><br /><br />
        <label>Version number:</label>
        <input value={versionNumber} onChange={(e) => { setSuccessfullySaved(false); setVersionNumber(e.target.value); setError(''); }} placeholder='x.y.z (y and z optional)' type='text' /> <br /><br />
        <label>Tag:</label>
        <input value={tag} onChange={(e) => { setTag(e.target.value); setError(''); setSuccessfullySaved(false); }} placeholder='e.g. finalised (optional)' type='text' /><br /><br />

        <Mutation<any, any>
            mutation={CREATE_DATA_CURATION_JOB}
            onCompleted={() => setSuccessfullySaved(true)}
            update={(store, { data: { createDataCurationJob } }) => {
                // Read the data from our cache for this query.
                const data: any = store.readQuery({ query: GET_STUDY, variables: { studyId } });
                // Add our comment from the mutation to the end.
                const newjobs = data.getStudy.jobs.concat(createDataCurationJob);
                data.getStudy.jobs = newjobs;
                // Write our data back to the cache.
                store.writeQuery({ query: GET_STUDY, variables: { studyId }, data });
            }}
        >
            {(createCurationJob, { loading }) => {
                if (loading) { return <button style={{ width: '45%', display: 'inline-block' }}>Loading..</button>; }
                return <button style={{ width: '45%', display: 'inline-block' }} onClick={() => {
                    if (!selectedFile) {
                        setError('Please select a file.');
                        setSuccessfullySaved(false);
                        return;
                    }
                    if (!versionNumber) {
                        setError('Version number cannot be empty.');
                        setSuccessfullySaved(false);
                        return;
                    }
                    if (!/^\d{1,3}(\.\d{1,2}){0,2}$/.test(versionNumber)) {
                        setError('Invalid version number.');
                        setSuccessfullySaved(false);
                        return;
                    }

                    createCurationJob({
                        variables: {
                            file: selectedFile,
                            studyId,
                            tag: tag === '' ? undefined : tag,
                            version: versionNumber
                        }
                    });

                }}>Submit</button>;
            }}
        </Mutation>
        <button style={{ width: '45%', display: 'inline-block' }} className='button_grey' onClick={() => cancelButton(false)}>Cancel</button>

        {error ? <div className='error_banner'>{error}</div> : null}
        {successfullySaved ? <div className='saved_banner'>Job created and queued.</div> : null}
    </>;

};
