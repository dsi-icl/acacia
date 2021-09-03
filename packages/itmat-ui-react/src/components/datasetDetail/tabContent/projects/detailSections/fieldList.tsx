import React from 'react';
import { Mutation, Query } from '@apollo/client/react/components';
import { useQuery } from '@apollo/client/react/hooks';
import {
    EDIT_PROJECT_APPROVED_FIELDS,
    GET_STUDY,
    GET_STUDY_FIELDS,
    IFieldEntry
} from 'itmat-commons';
import { FieldListSection } from '../../../../reusable/fieldList/fieldList';
import { LoadingBalls } from '../../../../reusable/icons/loadingBalls';


export const GrantedFieldListSection: React.FunctionComponent<{ originalCheckedList: { [fieldTreeId: string]: string[] }; studyId: string; projectId: string }> = ({ projectId, originalCheckedList, studyId }) => {
    const { loading, data, error } = useQuery(GET_STUDY, { variables: { studyId } });
    if (loading) { return <LoadingBalls />; }
    if (error) { return <p>{error.toString()}</p>; }
    const { getStudy } = data;

    if (!getStudy || !getStudy.dataVersions || getStudy.dataVersions.length === 0) {
        return <p>No data has been uploaded.</p>;
    }
    if (getStudy.dataVersions[getStudy.currentDataVersion] === undefined || getStudy.dataVersions[getStudy.currentDataVersion].fieldTrees === undefined || getStudy.dataVersions[getStudy.currentDataVersion].fieldTrees.length === 0) {
        return <p>No field tree uploaded.</p>;
    }

    return <FieldListSelectionState originalCheckedList={originalCheckedList} projectId={projectId} studyId={studyId} fieldTreeIds={getStudy.dataVersions[getStudy.currentDataVersion].fieldTrees} />;
};

const FieldListSelectionState: React.FunctionComponent<{ originalCheckedList: { [fieldTreeId: string]: string[] }; projectId: string; studyId: string; fieldTreeIds: string[] }> = ({ originalCheckedList, projectId, studyId, fieldTreeIds }) => {
    const [selectedTree, setSelectedTree] = React.useState(fieldTreeIds[0]);

    return <>
        <label>Select field tree: </label><select onChange={(e) => setSelectedTree(e.target.value)} value={selectedTree}>{fieldTreeIds.map((el) => <option key={el} value={el}>{el}</option>)}</select><br /><br />
        <Query<any, any> query={GET_STUDY_FIELDS} variables={{ studyId, fieldTreeId: selectedTree }}>
            {({ data, loading, error }) => {
                if (loading) { return <LoadingBalls />; }
                if (error) { return <p>{JSON.stringify(error)}</p>; }
                if (!data || !data.getStudyFields || data.getStudyFields.length === 0) { return <p>There is no field annotations uploaded for this tag.</p>; }
                // return <FieldListSection projectId={projectId} checkable={false} fieldList={data.getStudyFields} />;
                return <GrantedFieldListSectionSelectedFieldTree selectedTree={selectedTree} originalCheckedList={originalCheckedList} projectId={projectId} fieldList={data.getStudyFields} studyId={studyId} />;
            }}
        </Query>
    </>;
};

const GrantedFieldListSectionSelectedFieldTree: React.FunctionComponent<{ selectedTree: string; originalCheckedList: { [fieldTreeId: string]: string[] }; fieldList: IFieldEntry[]; studyId: string; projectId: string }> = ({ selectedTree, fieldList, originalCheckedList, projectId }) => {
    const [checkedList, setCheckedList] = React.useState(originalCheckedList[selectedTree] || []);
    const [savedSuccessfully, setSavedSuccessfully] = React.useState(false);
    const [currentProjectId, setCurrentProjectId] = React.useState(projectId);
    const [currentSelectedTree, setCurrentSelectedTree] = React.useState(selectedTree);

    if (currentProjectId !== projectId || selectedTree !== currentSelectedTree) {
        setCheckedList(originalCheckedList[selectedTree] || []);
        setSavedSuccessfully(false);
        setCurrentProjectId(projectId);
        setCurrentSelectedTree(selectedTree);
    }

    const onCheck = (checkedList: string[]) => {
        setCheckedList(checkedList);
    };

    return <>
        <FieldListSection onCheck={onCheck} checkedList={checkedList} checkable={true} fieldList={fieldList} />
        <Mutation<any, any>
            mutation={EDIT_PROJECT_APPROVED_FIELDS}
            onCompleted={() => setSavedSuccessfully(true)}
        >
            {(editApprovedFields, { loading, error }) =>
                <>
                    {
                        loading ? <button style={{ margin: '1rem 0 0 0' }}>Loading</button> :
                            <button style={{ margin: '1rem 0 0 0' }} onClick={() => {
                                editApprovedFields({ variables: { projectId, fieldTreeId: selectedTree, approvedFields: checkedList.filter((el) => el.indexOf('CAT') === -1) } });
                                setSavedSuccessfully(false);
                            }}>Save</button>
                    }
                    {
                        error ? <div className='error_banner'>{JSON.stringify(error)}</div> : null
                    }

                    {
                        savedSuccessfully ? <div className='saved_banner'>Saved!</div> : null
                    }
                </>
            }
        </Mutation>

    </>;
};

