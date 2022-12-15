import { FunctionComponent, useState } from 'react';
import { Mutation, Query } from '@apollo/client/react/components';
import { NavLink } from 'react-router-dom';
import { CREATE_DATA_CURATION_JOB, GET_STUDY } from '@itmat-broker/itmat-models';
import { IFile } from '@itmat-broker/itmat-types';
import LoadSpinner from '../../../reusable/loadSpinner';
import { Select, Button } from 'antd';
const { Option } = Select;

export const UploadNewData: FunctionComponent<{ studyId: string; cancelButton?: () => void }> = ({ studyId, cancelButton }) => {
    return <div>
        <p>To upload a new version of the dataset, please make sure you have <NavLink to={`/datasets/${studyId}/files`}><span style={{ color: 'var(--color-primary-color)', textDecoration: 'underline' }}>uploaded the data file to the file repository</span></NavLink>.</p>
        <br /><br />

        <Query<any, any> query={GET_STUDY} variables={{ studyId }}>
            {({ loading, data, error }) => {
                if (loading) { return <LoadSpinner />; }
                if (error) { return <p>{error.toString()}</p>; }
                if (!data.getStudy || data.getStudy.files === undefined || data.getStudy.files.length === 0) {
                    return null;
                }
                return <UploadNewDataForm cancelButton={cancelButton} studyId={studyId} files={data.getStudy.files} />;
            }}
        </Query>

    </div>;
};

const UploadNewDataForm: FunctionComponent<{ studyId: string; files: IFile[]; cancelButton?: () => void }> = ({ cancelButton, files, studyId }) => {
    const [error, setError] = useState('');
    const [successfullySaved, setSuccessfullySaved] = useState(false);
    const [selectedFile, setSelectedFile] = useState<string[]>([]); // files.length > 0 because of checks above
    const handleCancel = cancelButton === undefined ? (() => setSelectedFile([])) : cancelButton;

    const filteredFiles = files.filter(el => !(
        el.fileName.indexOf('VariablesList') >= 0
        || el.fileName.indexOf('Site') >= 0
        || el.fileName.indexOf('Codes') >= 0
        || el.fileName.indexOf('SubjectGroup') >= 0
        || el.fileName.indexOf('Tables') >= 0
        || el.fileName.indexOf('Visits') >= 0
    ));

    return <>
        <span>Data file:</span>
        <Select
            mode='multiple'
            onChange={(value) => {
                const newArr: string[] = [];
                for (let i = 0; i < (value as any).length; i++) {
                    newArr.push(value[i].toString());
                }
                setSelectedFile(newArr);
                setError('');
            }}
            value={selectedFile}
            style={{ width: '80%' }}
            placeholder='Select files'
        >
            {filteredFiles.map((el: IFile) => {
                return <Option value={el.id}>{el.fileName}</Option>;
            })}
        </Select><br /><br />

        <Mutation<any, any>
            mutation={CREATE_DATA_CURATION_JOB}
            onCompleted={() => setSuccessfullySaved(true)}
        // update={(store, { data: { createDataCurationJob } }) => {
        //     // Read the data from our cache for this query.
        //     const data: any = store.readQuery({ query: GET_STUDY, variables: { studyId } });
        //     // Add our comment from the mutation to the end.
        //     const newjobs = data.getStudy.jobs.concat(createDataCurationJob);
        //     data.getStudy.jobs = newjobs;
        //     // Write our data back to the cache.
        //     store.writeQuery({ query: GET_STUDY, variables: { studyId }, data });
        // }}
        >
            {(createCurationJob, { loading, error }) => {
                if (loading) { return <button style={{ width: '45%', display: 'inline-block' }}>Loading..</button>; }
                if (error) { return <button style={{ width: '45%', display: 'inline-block' }}>{JSON.stringify(error)}</button>; }
                return <Button style={{ width: '30%', display: 'inline-block' }} onClick={() => {
                    if (!selectedFile) {
                        setError('Please select a file.');
                        setSuccessfullySaved(false);
                        return;
                    }
                    createCurationJob({
                        variables: {
                            file: selectedFile,
                            studyId
                        }
                    });

                }}>Submit</Button>;
            }}
        </Mutation>
        <Button style={{ width: '30%', display: 'inline-block' }} className='button_grey' onClick={() => setSelectedFile(filteredFiles.map(el => el.id))}>Select All</Button>
        <Button style={{ width: '30%', display: 'inline-block' }} className='button_grey' onClick={handleCancel}>Cancel</Button>
        {error ? <div className='error_banner'>{error}</div> : null}
        {successfullySaved ? <div className='saved_banner'>Job created and queued.</div> : null}
    </>;

};

// const CreateNewDataVersion: FunctionComponent<{ studyId: string; dataVersion: string; tag: string }> = ({ studyId, dataVersion, tag }) => {

// };
