import { Models } from 'itmat-utils';
import * as React from 'react';
import { Tree, Input } from 'antd';
const { TreeNode } = Tree;
const { Search } = Input;
import 'antd/lib/tree/style/css';
import '../../../../css/antdOverride.css';
import { LoadingBalls } from '../../../reusable/loadingBalls';

class DraggableTreeNode extends TreeNode {
    // constructor(props: any, context: any) {
    //     super(props, {...context, rcTree :{ ...context.rcTree, draggable: true } });
    //     super(props);
    // }

    render = () => {
        this.context.rcTree.draggable = true;
        const treenode = super.render();
        return treenode;
    }
}


export const FieldListSection: React.FunctionComponent<{ fieldList: Models.Field.IFieldEntry[] }> = ({ fieldList }) => {
    // const sortedList = fieldList.sort((a, b) => `${a.Path} > ${a.Field}`.localeCompare(`${b.Path} > ${b.Field}`));
    if (fieldList.length === 0) { return <p>There is no available field for this project. Please contact admin or curator of this project.</p> }
    const transformedList = fieldList.map(el => `${el.path}>>${el.fieldId}|${el.fieldName}`);
    const makeTree = (paths: string[]) => {
        const output: any = [];
        for (let i = 0; i < paths.length; i++) {
            const currentPath = paths[i].split('>>');
            let currentNode = output;
            for (let j = 0; j < currentPath.length; j++) {
                const wantedNode = currentPath[j];
                const filteredNode = currentNode.filter((el: any) => el.name === wantedNode);
                if (filteredNode.length === 1) {
                    currentNode = filteredNode[0].children;
                } else {
                    const newNode = j === currentPath.length - 1 ? { fieldId: wantedNode.split('|')[0], name: wantedNode.split('|')[1], children: [] } : { name: wantedNode, children: [] };
                    currentNode.push(newNode);
                    currentNode = newNode.children;
                }
            }
        }
        return output;
    };

    const renderTreeNodes = (fieldList: any[]) => fieldList.map(item => {
        if (item.children.length !== 0) {
            return (
            <TreeNode title={item.name} key={item.name} dataRef={item} isLeaf={false} selectable={false}>
                {renderTreeNodes(item.children)}
            </TreeNode>
            );
        }
    return <DraggableTreeNode title={item.name} key={item.fieldId} dataRef={item} isLeaf={true} selectable={false}/>;
    });

    return (
        <Tree>
            {renderTreeNodes(makeTree(transformedList))}
        </Tree>
    );
};