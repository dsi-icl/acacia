import React from 'react';
import { Mutation, Query } from 'react-apollo';
import * as css from './tabContent.module.css';
import { GET_STUDY } from '../../../../graphql/study';
import { IStudy, IStudyDataVersion } from 'itmat-utils/dist/models/study';
import { LoadingBalls } from '../../../reusable/loadingBalls';
import { formatBytes } from '../../../reusable/fileList';
import { Subsection } from '../../../reusable';
import { GET_STUDY_FIELDS } from '../../../../graphql/fields';
import { FieldListSection } from '../../../reusable/fieldList';
// number of patients 
// newest version of data - date / tag
// download data
// data curation pipeline
// upload new sets of data


export const FieldListSelectionSection: React.FunctionComponent<{ studyId: string, selectedVersion: number, currentVersion: number, versions: IStudyDataVersion[] }> = ({ studyId, currentVersion, selectedVersion, versions }) => {


    const { fieldTrees } = versions[selectedVersion];

    return <>
        { selectedVersion === currentVersion ? null : <><span className='warning_banner'>Warning: You are not looking at the current version of the data.</span><br/><br/><br/></> }

        {
            fieldTrees.length === 0 ?
                <p>There is no field annotations uploaded for this data version yet.</p>
                :
                <FieldListSelectionState studyId={studyId} fieldTreeIds={fieldTrees}/>
        }
    </>;
};

const FieldListSelectionState: React.FunctionComponent<{ studyId: string, fieldTreeIds: string[] }> = ({ studyId, fieldTreeIds }) => {
    const [selectedTree, setSelectedTree] = React.useState(fieldTreeIds[0]);

    return <>
        <label>Select field tree: </label><select onChange={e => setSelectedTree(e.target.value)} value={selectedTree}>{fieldTreeIds.map(el => <option key={el} value={el}>{el}</option>)}</select><br/><br/>
        <Query query={GET_STUDY_FIELDS} variables={{ studyId, fieldTreeId: selectedTree }}>
        {({ data, loading, error }) => {
            if (loading) return <LoadingBalls/>;
            if (error) return <p>{JSON.stringify(error)}</p>;
            if (!data || !data.getStudyFields || data.getStudyFields.length === 0) return <p>There is no field annotations uploaded for this tag.</p>;
            return <FieldListSection checkable={false} fieldList={data.getStudyFields}/> 
        }}
        </Query>
    </>;

};
