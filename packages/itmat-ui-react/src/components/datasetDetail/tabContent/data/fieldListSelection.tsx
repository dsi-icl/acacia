import React from 'react';
import { Query } from '@apollo/client/react/components';
import { GET_STUDY_FIELDS, IStudyDataVersion } from 'itmat-commons';
import { FieldListSection } from '../../../reusable/fieldList/fieldList';
import { LoadingBalls } from '../../../reusable/icons/loadingBalls';
// number of patients
// newest version of data - date / tag
// download data
// data curation pipeline
// upload new sets of data

export const FieldListSelectionSection: React.FunctionComponent<{ studyId: string; selectedVersion: number; currentVersion: number; versions: IStudyDataVersion[] }> = ({ studyId, currentVersion, selectedVersion, versions }) => {

    const { fieldTrees } = versions[selectedVersion];

    return <>
        {selectedVersion === currentVersion ? null : <><span className='warning_banner'>Warning: You are not looking at the current version of the data.</span><br /><br /><br /></>}

        {
            fieldTrees.length === 0 ?
                <p>There is no field annotations uploaded for this data version yet.</p>
                :
                <FieldListSelectionState studyId={studyId} fieldTreeIds={fieldTrees} />
        }
    </>;
};

const FieldListSelectionState: React.FunctionComponent<{ studyId: string; fieldTreeIds: string[] }> = ({ studyId, fieldTreeIds }) => {
    const [selectedTree, setSelectedTree] = React.useState(fieldTreeIds[0]);

    return <>
        <label>Select field tree: </label><select onChange={(e) => setSelectedTree(e.target.value)} value={selectedTree}>{fieldTreeIds.map((el) => <option key={el} value={el}>{el}</option>)}</select><br /><br />
        <Query<any, any> query={GET_STUDY_FIELDS} variables={{ studyId, fieldTreeId: selectedTree }}>
            {({ data, loading, error }) => {
                if (loading) { return <LoadingBalls />; }
                if (error) { return <p>{JSON.stringify(error)}</p>; }
                if (!data || !data.getStudyFields || data.getStudyFields.length === 0) { return <p>There is no field annotations uploaded for this tag.</p>; }
                return <FieldListSection checkable={false} fieldList={data.getStudyFields} />;
            }}
        </Query>
    </>;

};
