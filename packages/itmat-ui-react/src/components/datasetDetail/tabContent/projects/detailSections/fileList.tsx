import { Tree } from 'antd';
import React from 'react';
import { Mutation, Query } from '@apollo/client/react/components';
import { EDIT_PROJECT_APPROVED_FILES, IFile, GET_STUDY } from 'itmat-commons';
import { LoadingBalls } from '../../../../reusable/icons/loadingBalls';

export const GrantedFileListSelection: React.FunctionComponent<{ originalCheckedList: string[]; studyId: string; projectId: string }> = ({ projectId, originalCheckedList, studyId }) => {
    const [checkedList, setCheckedList] = React.useState(originalCheckedList || []);
    const [savedSuccessfully, setSavedSuccessfully] = React.useState(false);
    const [currentProjectId, setCurrentProjectId] = React.useState(projectId);

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
            if (loading) { return <LoadingBalls />; }
            if (error) { return <p>Error :( {JSON.stringify(error)}</p>; }

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
                                loading ? <button style={{ margin: '1rem 0 0 0' }}>Loading</button> :
                                    <button style={{ margin: '1rem 0 0 0' }} onClick={() => {
                                        editApprovedFiles({ variables: { projectId, approvedFiles: checkedList } });
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
