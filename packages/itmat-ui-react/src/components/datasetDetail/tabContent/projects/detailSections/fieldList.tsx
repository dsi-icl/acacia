import { FunctionComponent, useState } from 'react';
import { Mutation } from '@apollo/client/react/components';
import { useQuery } from '@apollo/client/react/hooks';
import { EDIT_PROJECT_APPROVED_FIELDS, GET_STUDY, GET_STUDY_FIELDS } from '@itmat-broker/itmat-models';
import { IFieldEntry } from '@itmat-broker/itmat-types';
import { FieldListSection } from '../../../../reusable/fieldList/fieldList';
import LoadSpinner from '../../../../reusable/loadSpinner';
import { Button } from 'antd';

export const GrantedFieldListSection: FunctionComponent<{ originalCheckedList: string[]; studyId: string; projectId: string }> = ({ projectId, originalCheckedList, studyId }) => {
    const { loading, data, error } = useQuery(GET_STUDY, { variables: { studyId } });
    if (loading) { return <LoadSpinner />; }
    if (error) { return <p>{error.toString()}</p>; }
    const { getStudy } = data;

    if (!getStudy || !getStudy.dataVersions || getStudy.dataVersions.length === 0) {
        return <p>No data has been uploaded.</p>;
    }
    return <FieldListSelectionState originalCheckedList={originalCheckedList} projectId={projectId} studyId={studyId} />;
};

const FieldListSelectionState: FunctionComponent<{ originalCheckedList: string[]; projectId: string; studyId: string; }> = ({ originalCheckedList, projectId, studyId }) => {
    const { loading: getStudyFieldsLoading, error: getStudyFieldsError, data: getStudyFieldsData } = useQuery(GET_STUDY_FIELDS, { variables: { studyId: studyId } });

    if (getStudyFieldsLoading) {
        return <LoadSpinner />;
    }

    if (getStudyFieldsError) {
        return <p>
            An error occured, please contact your administrator: {(getStudyFieldsError as any).message || ''}
        </p>;
    }
    return <GrantedFieldListSectionSelectedFieldTree originalCheckedList={originalCheckedList} projectId={projectId} fieldList={getStudyFieldsData.getStudyFields} studyId={studyId} />;
};

const GrantedFieldListSectionSelectedFieldTree: FunctionComponent<{ originalCheckedList: string[]; fieldList: IFieldEntry[]; studyId: string; projectId: string }> = ({ studyId, fieldList, originalCheckedList, projectId }) => {
    const [checkedList, setCheckedList] = useState(originalCheckedList || []);
    const [savedSuccessfully, setSavedSuccessfully] = useState(false);
    const { loading, data, error } = useQuery(GET_STUDY, { variables: { studyId } });
    if (loading) { return <LoadSpinner />; }
    if (error) { return <p>{error.toString()}</p>; }

    const onCheck = (checkedList: string[]) => {
        setCheckedList(checkedList);
    };
    return <>
        <FieldListSection studyData={data.getStudy} onCheck={onCheck} checkedList={checkedList} checkable={true} fieldList={fieldList} />
        <Mutation<any, any>
            mutation={EDIT_PROJECT_APPROVED_FIELDS}
            onCompleted={() => setSavedSuccessfully(true)}
        >
            {(editApprovedFields, { loading, error }) =>
                <>
                    {
                        loading ? <button style={{ margin: '1rem 0 0 0' }}>Loading</button> :
                            <Button style={{ margin: '1rem 0 0 0' }} onClick={() => {
                                editApprovedFields({ variables: { projectId, approvedFields: checkedList.filter((el) => (el.indexOf('CAT') === -1 && el.indexOf('Study') === -1)) } });
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

