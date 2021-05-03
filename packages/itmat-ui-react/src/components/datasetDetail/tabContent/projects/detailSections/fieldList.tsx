import React from 'react';
import { Mutation } from '@apollo/client/react/components';
import { useQuery } from '@apollo/client/react/hooks';
import {
    EDIT_PROJECT_APPROVED_FIELDS,
    GET_STUDY,
    GET_STUDY_FIELDS,
    IFieldEntry
} from 'itmat-commons';
import { FieldListSection } from '../../../../reusable/fieldList/fieldList';
import LoadSpinner from '../../../../reusable/loadSpinner';
import { Button, Select } from 'antd';
const { Option } = Select;

export const GrantedFieldListSection: React.FunctionComponent<{ originalCheckedList: { [fieldTreeId: string]: string[] }; studyId: string; projectId: string }> = ({ projectId, originalCheckedList, studyId }) => {
    const { loading, data, error } = useQuery(GET_STUDY, { variables: { studyId } });
    if (loading) { return <LoadSpinner />; }
    if (error) { return <p>{error.toString()}</p>; }
    const { getStudy } = data;

    if (!getStudy || !getStudy.dataVersions || getStudy.dataVersions.length === 0) {
        return <p>No data has been uploaded.</p>;
    }
    // if (getStudy.dataVersions[getStudy.currentDataVersion] === undefined || getStudy.dataVersions[getStudy.currentDataVersion].fieldTrees === undefined || getStudy.dataVersions[getStudy.currentDataVersion].fieldTrees.length === 0) {
    //     return <p>No field tree uploaded.</p>;
    // }

    return <FieldListSelectionState originalCheckedList={originalCheckedList} projectId={projectId} studyId={studyId} />;
};

const FieldListSelectionState: React.FunctionComponent<{ originalCheckedList: { [fieldTreeId: string]: string[] }; projectId: string; studyId: string; }> = ({ originalCheckedList, projectId, studyId }) => {
    const { loading: getStudyFieldsLoading, error: getStudyFieldsError, data: getStudyFieldsData } = useQuery(GET_STUDY_FIELDS, { variables: { studyId: studyId } });
    const [selectedFieldTreeId, setSelectedFieldTreeId] = React.useState('');

    if (getStudyFieldsLoading) {
        return <LoadSpinner />;
    }

    if (getStudyFieldsError) {
        return <p>
            A error occured, please contact your administrator: {(getStudyFieldsError as any).message || ''}
        </p>;
    }
    const uniqueFieldTreeIds: string[] = Array.from(new Set(getStudyFieldsData.getStudyFields.map(el => el.fieldTreeId)));
    console.log(uniqueFieldTreeIds);
    return <>
        <Select
            placeholder='Select Field'
            allowClear
            onChange={(value) => {
                console.log(value);
                setSelectedFieldTreeId(value.toString());
            }}
            style={{width: '80%'}}
        >
            {uniqueFieldTreeIds.map((el) => <Option value={el} >{el}</Option>)}
        </Select>
        <GrantedFieldListSectionSelectedFieldTree selectedTree={selectedFieldTreeId} originalCheckedList={originalCheckedList} projectId={projectId} fieldList={getStudyFieldsData.getStudyFields.filter(el => el.fieldTreeId === selectedFieldTreeId)} studyId={studyId} />;
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
                            <Button style={{ margin: '1rem 0 0 0' }} onClick={() => {
                                editApprovedFields({ variables: { projectId, fieldTreeId: selectedTree, approvedFields: checkedList.filter((el) => el.indexOf('CAT') === -1) } });
                                setSavedSuccessfully(false);
                            }}>Save</Button>
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

