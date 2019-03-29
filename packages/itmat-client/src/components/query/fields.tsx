import { Models } from 'itmat-utils';
import * as React from 'react';
import { Tree, Input } from 'antd';
const { TreeNode } = Tree;
const { Search } = Input;
import 'antd/lib/tree/style/css';
import '../../css/antdOverride.css';
import Title from 'antd/lib/skeleton/Avatar';

// class DraggableTreeNode extends TreeNode {
//     constructor(props: any) {
//         super(props);
//     }

//     transformRender = (def: string) => {
//         console.log(def);
//         def = def.replace('function render() {', '');
//         const lastParenthesisIndex = def.lastIndexOf('}');
//         def = def.substring(0, lastParenthesisIndex);
//         const returnindex = def.indexOf('return ');
//         const newRenderFunction = new Function(`${def.substring(0, returnindex)}\n draggable = true;\n${def.substring(returnindex, def.length)}`);
//         console.log(newRenderFunction);
//         return newRenderFunction;
//     }

//     render = this.transformRender(super.render.toString()) as any;
// }


export const FieldListSection: React.FunctionComponent<{ fieldList: Models.Field.IFieldEntry[] }> = ({ fieldList }) => {
    // const sortedList = fieldList.sort((a, b) => `${a.Path} > ${a.Field}`.localeCompare(`${b.Path} > ${b.Field}`));
    const transformedList = fieldList.map(el => `${el.Path} > ${el.FieldID}|${el.Field}`);
    const makeTree = (paths: string[]) => {
        const output: any = [];
        for (let i = 0; i < paths.length; i++) {
            const currentPath = paths[i].split(' > ');
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
        return <TreeNode title={item.name} key={item.fieldId} dataRef={item} isLeaf={true} selectable={false}/>;
    });

    return (
        <>
        <h4>Available Fields</h4>
        <Tree.DirectoryTree>
            {renderTreeNodes(makeTree(transformedList))}
        </Tree.DirectoryTree>
        </>
    );
};