import React from 'react';
import { Query, Mutation } from 'react-apollo';
import * as css from './tabContent.module.css';
import { NavLink } from 'react-router-dom';
import { GET_STUDY } from '../../../../graphql/study';
import { LoadingBalls } from '../../../reusable/loadingBalls';
import { IFile } from 'itmat-utils/dist/models/file';
// number of patients 
// newest version of data - date / tag
// download data
// data curation pipeline
// upload new sets of data
export const UploadNewData: React.FunctionComponent<{ studyId: string }> = ({ studyId }) => {
    return <div>
        <p>To upload a new version of the dataset, please make sure you have <NavLink to={`/datasets/${studyId}/files`}><span style={{ color: 'var(--color-that-orange)', textDecoration: 'underline'}}>uploaded the data file to the file repository</span></NavLink>.</p>
        <br/><br/>
        <label>Data file:</label>
        <Query query={GET_STUDY} variables={{ studyId }}>
                {({ loading, data, error }) => {
                    if (loading) return <LoadingBalls/>;
                    if (error) return <p>{error.toString()}</p>
                    if (!data.getStudy || !data.getStudy.files || data.getStudy.files.length === 0) {
                        return <p>There seems to be no files for this study. You can start uploading files.</p>;
                    }
                    return <><select>{data.getStudy.files.map((el: IFile) => <option key={el.id} value={el.id}>{el.fileName}</option>)}</select><br/><br/></>;
                }}
        </Query>
        <label>Version number:</label> <input type='text'/><br/><br/>
        <label>Tag:</label> <input type='text'/><br/><br/>

        <button>Submit</button>

    </div>;
};