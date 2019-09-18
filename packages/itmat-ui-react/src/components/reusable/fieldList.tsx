import { Models } from 'itmat-utils';
import * as React from 'react';
import { Tree, Input } from 'antd';
import 'antd/lib/tree/style/css';
import '../../css/antdOverride.css';
import { LoadingBalls } from './loadingBalls';
const { TreeNode } = Tree;
const { Search } = Input;

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


export const FieldListSection: React.FunctionComponent<{ onCheck?: any, checkedList?: string[], checkable: boolean, fieldList: Models.Field.IFieldEntry[] }> = ({ onCheck, checkedList, checkable, fieldList }) => {

    // TEMPORARY
    return <p>PLACEHOLER</p>;

    if (fieldList.length === 0) { return <p>There is no available field for this project. Please contact admin or curator of this project.</p> }
    const transformedList = fieldList.map(el => `${el.path}>>${el.id}|${el.fieldName}`);
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
                    const newNode = j === currentPath.length - 1 ? { fieldId: wantedNode.split('|')[0], name: wantedNode.split('|')[1], children: [] } : { fieldId: `CAT:${currentPath.slice(0, j + 1).join('>>')}`, name: wantedNode, children: [] };
                    currentNode.push(newNode);
                    currentNode = newNode.children;
                }
            }
        }
        console.log(output);
        return output;
    };

    const renderTreeNodes = (fieldList: any[]) => fieldList.map(item => {
        if (item.children.length !== 0) {
            return (
            <TreeNode title={item.name} key={item.fieldId} dataRef={item} isLeaf={false} selectable={false}>
                {renderTreeNodes(item.children)}
            </TreeNode>
            );
        }
        return checkable ? <TreeNode title={item.name} key={item.fieldId} dataRef={item} isLeaf={true}/> : <DraggableTreeNode title={item.name} key={item.fieldId} dataRef={item} isLeaf={true} selectable={false}/>;
    });


    if (checkable) {
        return (
            <Tree
                checkable
                onCheck={onCheck}
                checkedKeys={checkedList}
            >
                {renderTreeNodes(makeTree(transformedList))}
            </Tree>
        );
    } else {
        return (
            <Tree>
                {renderTreeNodes(makeTree(transformedList))}
            </Tree>);

    }
};