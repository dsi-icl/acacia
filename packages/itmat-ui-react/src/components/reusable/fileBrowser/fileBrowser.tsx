import React from 'react';
// import style from 'fileBrowser.module.css';
import {
    GET_STUDY,
    GET_USERS,
    IStudy,
    IUser,
    GET_FILE_WITH_CHILDREN,
    FETCH_CHILD_FILES,
    IFileMongoEntry,
    fileTypesDirs
} from 'itmat-commons';
// import { RouteComponentProps } from 'react-router-dom';
import { Tree } from 'antd';
import { useQuery, Query, useLazyQuery } from 'react-apollo';
import { LoadingBalls } from '../icons/loadingBalls';


interface DataNode {
    title: string;
    key: string;
    isLeaf?: boolean;
    children?: DataNode[];
}

export const FileBrowser: React.FunctionComponent<{ studyId?: string, userId?: string }> = ({ studyId, userId }) => {
    if (studyId && userId) {
        return <p>Error displaying files.</p>;
    } else if (studyId) {
        return <StudyFileBrowserFetch studyId={studyId} />;
    } else if (userId) {
        return <UserFileBrowserFetch userId={userId} />;
    } else {
        return <p>Error displaying files.</p>;
    }
};

const StudyFileBrowserFetch: React.FunctionComponent<{ studyId: string }> = ({ studyId }) => {
    const { loading, error, data } = useQuery(GET_STUDY, { variables: { studyId } });
    if (loading) { return <LoadingBalls />; }
    if (error) { return <p>Error fetching study</p>; }

    const study: IStudy = data.getStudy;
    if (!study) {
        return <p>Error fetching study</p>;
    }
    return <FileBrowserRender rootDirId={study.rootDir} />;
};

const UserFileBrowserFetch: React.FunctionComponent<{ userId: string }> = ({ userId }) => {
    const { loading, error, data } = useQuery(GET_USERS, { variables: { userId } });
    if (loading) { return <LoadingBalls />; }
    if (error) { return <p>Error fetching user</p>; }

    const user: IUser = data.getUsers;
    if (!user) {
        return <p>Error fetching user</p>;
    }
    return <FileBrowserRender rootDirId={user.rootDir} />;
};

const FileBrowserRender: React.FunctionComponent<{ rootDirId: string }> = ({ rootDirId }) => {
    const [fetchChildFiles] = useLazyQuery(FETCH_CHILD_FILES);
    return <Query<any, any> query={GET_FILE_WITH_CHILDREN} variables={{ fileId: rootDirId }}>
        {({ data: rootData, loading: rootLoading, error: rootError }) => {
            if (rootLoading) { return <LoadingBalls />; }
            if (rootError) { return <p>Error fetching file</p>; }
            return <div>
                <Tree
                    // onSelect={onSelect}
                    loadData={({ key, children }) => {
                        return new Promise((resolve) => {
                            if (children) resolve();
                            fetchChildFiles({ variables: { dirFileId: key } });
                            resolve();
                        });
                    }}
                    treeData={[mapGraphqlFilesToAntdTreeDataNode(rootData.getFile)]}
                    showLine
                />
            </div>;
        }}
    </Query>;
};


type GQLFile = Omit<IFileMongoEntry, 'childFileIds'> & { childFiles?: GQLFile[] }
// function mapGraphqlFilesToAntdTreeData(file: GQLFile): any {
//     const isLeaf = !fileTypesDirs.includes(file.fileType);
//     const childFilesFetched = file.childFiles !== undefined;
//     if (isLeaf) {
//         return <TreeNode isLeaf={true} title={file.fileName} key={file.id}/>;
//     } else if (!childFilesFetched) {
//         return <TreeNode isLeaf={false} title={file.fileName} key={file.id}/>;
//     } else {
//         return <TreeNode isLeaf={false} title={file.fileName} key={file.id}>
//             {file.childFiles!.map(mapGraphqlFilesToAntdTreeData)}
//         </TreeNode>;
//     }
// }

function mapGraphqlFilesToAntdTreeDataNode(file: GQLFile): DataNode {
    const isLeaf = !fileTypesDirs.includes(file.fileType);
    return ({
        title: file.fileName,
        key: file.id,
        isLeaf,
        children: isLeaf || !file.childFiles ? undefined : file.childFiles.map(mapGraphqlFilesToAntdTreeDataNode)
    });
}
