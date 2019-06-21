import React from 'react';
import { Query, Mutation } from 'react-apollo';
import { LoadingBalls } from '../../../../reusable/loadingBalls';
import { FieldListSection } from '../../../../projectDetail/tabContent/data/fieldList';
import { EDIT_PROJECT_APPROVED_FIELDS, GET_PROJECT } from '../../../../../graphql/projects';
import { GET_STUDY } from '../../../../../graphql/study';

export const GrantedFieldListSection: React.FunctionComponent<{ originalCheckedList: string[], studyId: string, projectId: string }> = ({ projectId, originalCheckedList, studyId }) => {
    const [checkedList, setCheckedList] = React.useState(originalCheckedList || []);
    const [savedSuccessfully, setSavedSuccessfully] = React.useState(false);

    const onCheck = (checkedList: string[]) => {
        setCheckedList(checkedList);
    };

    return <Query query={GET_STUDY} variables={{ studyId }}>
        {({ loading, data: fieldData, error }) => {
            if (loading) return <LoadingBalls/>;
            if (error) return <p>Error :( {JSON.stringify(error)}</p>; 

            return <>
                    <FieldListSection onCheck={onCheck} checkedList={checkedList} checkable={true} fieldList={fieldData.getStudy.fields}/>
                    <Mutation
                        mutation={EDIT_PROJECT_APPROVED_FIELDS}
                        onCompleted={() => setSavedSuccessfully(true)}
                    >
                    {(editApprovedFields, { loading, error }) => 
                        <>
                        {
                            loading ? <button style={{ margin: '1rem 0 0 0' }}>Loading</button> : 
                            <button style={{ margin: '1rem 0 0 0' }} onClick={() => { 
                                   editApprovedFields({ variables: { projectId, approvedFields: checkedList.filter(el => el.indexOf('CAT') === -1) }});
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
        }}
    </Query>;
};