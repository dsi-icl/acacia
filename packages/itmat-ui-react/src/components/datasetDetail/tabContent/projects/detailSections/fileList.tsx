import { FunctionComponent, useState } from 'react';
import { Tree } from 'antd';
import { Mutation, Query } from '@apollo/client/react/components';
import { EDIT_PROJECT_APPROVED_FILES, GET_STUDY } from '@itmat-broker/itmat-models';
import { IFile } from '@itmat-broker/itmat-types';
import LoadSpinner from '../../../../reusable/loadSpinner';
import { Button } from 'antd';

export const GrantedFileListSelection: FunctionComponent<{ originalCheckedList: string[]; studyId: string; projectId: string }> = ({ projectId, originalCheckedList, studyId }) => {
    const [checkedList, setCheckedList] = useState(originalCheckedList || []);
    const [savedSuccessfully, setSavedSuccessfully] = useState(false);
    const [currentProjectId, setCurrentProjectId] = useState(projectId);

    if (currentProjectId !== projectId) {
        setCheckedList(originalCheckedList);
        setSavedSuccessfully(false);
        setCurrentProjectId(projectId);
    }

    const onCheck = (checkedList: string[]) => {
        setCheckedList(checkedList);
    };

    return <Query<any, any> query={GET_STUDY} variables={{ studyId }}>
        {({ loading, data: fileData, error }) => {
            if (loading) { return <LoadSpinner />; }
            if (error) { return <p>Error {JSON.stringify(error)}</p>; }

            return <>
                <Tree
                    checkable
                    onCheck={onCheck as any}
                    checkedKeys={checkedList}
                >
                    {fileData.getStudy.files.map((el: IFile) => <Tree.TreeNode title={el.fileName} key={el.id} isLeaf={true} />)}
                </Tree>
                <Mutation<any, any>
                    mutation={EDIT_PROJECT_APPROVED_FILES}
                    onCompleted={() => setSavedSuccessfully(true)}
                >
                    {(editApprovedFiles, { loading, error }) =>
                        <>
                            {
                                loading ? <Button style={{ margin: '1rem 0 0 0' }}>Loading</Button> :
                                    <Button style={{ margin: '1rem 0 0 0' }} onClick={() => {
                                        editApprovedFiles({ variables: { projectId, approvedFiles: checkedList } });
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
        }}
    </Query>;
};
