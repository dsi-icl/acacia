import React from 'react';
import style from 'fileBrowser.module.css';
import { IUser, IStudy, GET_STUDY, GET_USERS } from 'itmat-commons';
import { RouteComponentProps } from 'react-router-dom';
import { Tree } from 'antd';
import { useQuery } from 'react-apollo';
const { TreeNode } = Tree;

type FileBrowserProp = RouteComponentProps<{
    studyId?: string;
    userId?: string;
}>

interface DataNode {
    title: string;
    key: string;
    isLeaf?: boolean;
    children?: DataNode[];
}

export const FileBrowser: React.FunctionComponent<FileBrowserProp> = ({ match: { params: { studyId, userId } } }) => {
    if (studyId && userId) {
        return <p>Error displaying files.</p>;
    } else if (studyId) {
        return <StudyFileBrowserFetch studyId={studyId}/>;
    } else if (userId) {
        return <UserFileBrowserFetch userId={userId}/>;
    } else {
        return <p>Error displaying files.</p>;
    }
};

const StudyFileBrowserFetch: React.FunctionComponent<{ studyId: string }> = ({ studyId }) => {
    const x = useQuery(GET_STUDY, { variables: { studyId } });

    return <FileBrowserRender/>;
};

const UserFileBrowserFetch: React.FunctionComponent<{ userId: string }> = ({ userId }) => {
    const x = useQuery(GET_USERS, { variables: { userId } });

    return <FileBrowserRender/>;
};

const FileBrowserRender: React.FunctionComponent<{ user?: IUser, study?: IStudy }> = ({ study, user }) => {
    if (study && user) {
        return <p>Error displaying files.</p>;
    } else if (study) {

    } else if (user) {

    } else {

    }

    const onSelect = (selectedKeys, info) => {
        console.log('selected', selectedKeys, info);
    };

    const onCheck = (checkedKeys, info) => {
        console.log('onCheck', checkedKeys, info);
    };

    return <div>
        <Tree
            checkable
            defaultExpandedKeys={['0-0-0', '0-0-1']}
            defaultSelectedKeys={['0-0-0', '0-0-1']}
            defaultCheckedKeys={['0-0-0', '0-0-1']}
            onSelect={onSelect}
            onCheck={onCheck}
            treeData={treeData}
        />
    </div>;
};