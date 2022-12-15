import { FunctionComponent, useState } from 'react';
import { Query } from '@apollo/client/react/components';
import { useQuery } from '@apollo/client/react/hooks';
import { GET_STUDY_FIELDS, GET_STUDY } from '@itmat-broker/itmat-models';
import { IStudyDataVersion } from '@itmat-broker/itmat-types';
import { FieldListSection } from '../../../reusable/fieldList/fieldList';
import LoadSpinner from '../../../reusable/loadSpinner';
// number of patients
// newest version of data - date / tag
// download data
// data curation pipeline
// upload new sets of data

export const FieldListSelectionSection: FunctionComponent<{ studyId: string; selectedVersion: number; currentVersion: number; versions: IStudyDataVersion[] }> = ({ studyId, currentVersion, selectedVersion }) => {
    const { loading: getStudyLoading, error: getStudyError, data: getStudyData } = useQuery(GET_STUDY, { variables: { studyId: studyId } });
    const { loading: getStudyFieldsLoading, error: getStudyFieldsError, data: getStudyFieldsData } = useQuery(GET_STUDY_FIELDS, { variables: { studyId: studyId } });
    if (getStudyLoading || getStudyFieldsLoading) {
        return <LoadSpinner />;
    }
    if (getStudyError || getStudyFieldsError) {
        return <p>
            An error occured, please contact your administrator
        </p>;
    }
    // leave as placeholder;
    // const { fieldTrees } = versions[selectedVersion];
    const fieldTrees = getStudyFieldsData.getStudyFields;

    return <>
        {selectedVersion === currentVersion ? null : <><span className='warning_banner'>Warning: You are not looking at the current version of the data.</span><br /><br /><br /></>}

        {
            fieldTrees.length === 0 ?
                <p>There is no field annotations uploaded for this data version yet.</p>
                :
                <FieldListSelectionState studyId={studyId} fieldTreeIds={fieldTrees} studyData={getStudyData} />
        }
    </>;
};

const FieldListSelectionState: FunctionComponent<{ studyId: string; fieldTreeIds: string[], studyData: any }> = ({ studyId, fieldTreeIds, studyData }) => {
    const [selectedTree, setSelectedTree] = useState(fieldTreeIds[0]);

    return <>
        <label>Select field tree: </label><select title='Field Tree' onChange={(e) => setSelectedTree(e.target.value)} value={selectedTree}>{fieldTreeIds.map((el) => <option key={el} value={el}>{el}</option>)}</select><br /><br />
        <Query<any, any> query={GET_STUDY_FIELDS} variables={{ studyId, fieldTreeId: selectedTree }}>
            {({ data, loading, error }) => {
                if (loading) { return <LoadSpinner />; }
                if (error) { return <p>{JSON.stringify(error)}</p>; }
                if (!data || !data.getStudyFields || data.getStudyFields.length === 0) { return <p>There is no field annotations uploaded for this tag.</p>; }
                return <FieldListSection checkable={false} fieldList={data.getStudyFields} studyData={studyData.getStudy} />;
            }}
        </Query>
    </>;

};
