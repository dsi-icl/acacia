import { Models } from 'itmat-commons';
import * as React from 'react';
import { Tree, Form, Modal, Input, Select } from 'antd';
import 'antd/lib/tree/style/css';
const { TreeNode } = Tree;

// class DraggableTreeNode extends TreeNode {

//     // constructor(props: any, context: any) {
//     //     super(props, {...context, rcTree :{ ...context.rcTree, draggable: true } });
//     //     super(props);
//     // }

//     render = () => {
//         this.context.rcTree.draggable = true;
//         const treenode = super.render();
//         return treenode;
//     }
// }

export const FieldListSection: React.FunctionComponent<{ studyData?: any, onCheck?: any; checkedList?: string[]; checkable: boolean; fieldList: Models.Field.IFieldEntry[] }> = ({ studyData, onCheck, checkedList, checkable, fieldList }) => {
    const fieldIdNameMapping = [];
    fieldList.forEach(el => fieldIdNameMapping[el.fieldName] = el.id);
    if (fieldList.length === 0) { return <p>There is no available field for field tree. Please contact admin or curator of this project.</p>; }
    const transformedList = fieldList.map((el) => {
        // const findPath = getstudyd
        if (studyData.ontologyTree === undefined || studyData.ontologyTree === null || studyData.ontologyTree.length === 0) {
            return `${'Others'}>${el.fieldName}>${el.id}|${el.fieldName}`;
        } else {
            const ontologyField = studyData.ontologyTree.filter(es => es.fieldId === el.fieldId);
            if (ontologyField.length === 0) {
                return `${'Others'}>${el.fieldName}>${el.id}|${el.fieldName}`;
            } else {
                return `${constructPath(ontologyField[0].path, fieldList)}>${el.id}|${el.fieldName}`;
            }
        }
    });
    transformedList.sort((a, b) => {
        if (a.split('>')[0] < b.split('>')[0]) {
            return -1;
        } else {
            return 0;
        }
    });
    const makeTree = (paths: string[]) => {
        const output: any = [];
        for (let i = 0; i < paths.length; i++) {
            const currentPath = paths[i].split('>');
            let currentNode = output;
            for (let j = 0; j < currentPath.length; j++) {
                const wantedNode = currentPath[j];
                const filteredNode = currentNode.filter((el: any) => el.name === wantedNode);
                if (filteredNode.length === 1) {
                    currentNode = filteredNode[0].children;
                } else {
                    const newNode = j === currentPath.length - 1 ? { fieldId: wantedNode.split('|')[0], name: wantedNode.split('|')[1], children: [] } : { fieldId: `CAT:${currentPath.slice(0, j + 1).join('>')}`, name: wantedNode, children: [] };
                    currentNode.push(newNode);
                    currentNode = newNode.children;
                }
            }
        }
        const pushed: any = [];
        for (let i = 0; i < output.length; i++) {
            pushed.push(output[i]);
        }
        if (studyData) {
            const withStudy: any = [{ fieldId: 'Study:'.concat(studyData.name), name: 'Study:'.concat(studyData.name), children: pushed }];
            return withStudy;
        } else {
            return output;
        }
    };
    const renderTreeNodes = (fieldList: any[]) => fieldList.map(item => {
        if (item.children.length !== 0) {
            return (
                <TreeNode title={item.name} key={item.fieldId} isLeaf={false} selectable={false}>
                    {renderTreeNodes(item.children)}
                </TreeNode>
            );
        }
        // return checkable ? <TreeNode title={item.name} key={item.fieldId} dataRef={item} isLeaf={true} /> : <DraggableTreeNode title={item.name} key={item.fieldId} dataRef={item} isLeaf={true} selectable={false} />;
        return <TreeNode title={item.name} key={item.fieldId} isLeaf={true} />;
    });

    if (checkable) {
        return (
            <Tree
                checkable={checkable}
                onCheck={(checkedList) => { onCheck(checkedList); }}
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

export const FieldListSectionWithFilter: React.FunctionComponent<{ ontologyTree: any, onCheck?: any; checkedList?: string[]; checkable: boolean; fieldList: Models.Field.IFieldEntry[], queryOptions: any }> = ({ ontologyTree, onCheck, checkedList, checkable, fieldList, queryOptions }) => {

    const [isModalShown, setIsModalShown] = React.useState(false); // show filter inputs
    // const [derivedFields, setDerivedFields] = React.useState<any[]>([]);
    const [selectedNode, setSelectedNode] = React.useState<string>('');

    const filteredFieldList = fieldList.filter(el => el.fieldName !== 'SubjectID' && el.fieldName !== 'VisitID');
    const fieldIdNameMapping = [];
    filteredFieldList.forEach(el => fieldIdNameMapping[el.fieldName] = el.id);
    if (filteredFieldList.length === 0) { return <p>There is no available field for this field tree. Please contact admin or curator of this project.</p>; }
    const transformedList = fieldList.map((el) => {
        // const findPath = getstudyd
        if (ontologyTree === undefined || ontologyTree === null || ontologyTree.length === 0) {
            return `${'Others'}>${el.id}|${el.fieldName}`;
        } else {
            const ontologyField = ontologyTree.filter(es => es.fieldId === el.fieldId);
            if (ontologyField.length === 0) {
                return `${'Others'}>${el.id}|${el.fieldName}`;
            } else {
                return `${constructPath(ontologyField[0].path, fieldList)}>${el.id}|${el.fieldName}`;
            }
        }

    });
    transformedList.sort((a, b) => {
        if (a.split('>')[0] < b.split('>')[0]) {
            return -1;
        } else {
            return 0;
        }
    });
    const makeTree = (paths: string[]) => {
        const output: any = [];
        for (let i = 0; i < paths.length; i++) {
            const currentPath = paths[i].split('>');
            let currentNode = output;
            for (let j = 0; j < currentPath.length; j++) {
                const wantedNode = currentPath[j];
                const filteredNode = currentNode.filter((el: any) => el.name === wantedNode);
                if (filteredNode.length === 1) {
                    currentNode = filteredNode[0].children;
                } else {
                    const newNode = j === currentPath.length - 1 ? { fieldId: wantedNode.split('|')[0], name: wantedNode.split('|')[1], children: [] } : { fieldId: `CAT:${currentPath.slice(0, j + 1).join('>')}`, name: wantedNode, children: [] };
                    currentNode.push(newNode);
                    currentNode = newNode.children;
                }
            }
        }
        const pushed: any = [];
        for (let i = 0; i < output.length; i++) {
            pushed.push(output[i]);
        }
        return output;
    };
    const renderTreeNodes = (fieldList: any[]) => fieldList.map(item => {
        if (item.children.length !== 0) {
            return (
                <TreeNode title={item.name} key={item.fieldId} isLeaf={false} selectable={false}>
                    {renderTreeNodes(item.children)}
                </TreeNode>
            );
        }
        // return checkable ? <TreeNode title={item.name} key={item.fieldId} dataRef={item} isLeaf={true} /> : <DraggableTreeNode title={item.name} key={item.fieldId} dataRef={item} isLeaf={true} selectable={false} />;
        return <TreeNode title={item.name} key={item.fieldId} isLeaf={true} />;
    });
    if (checkable) {
        return (
            <>
                <ValueEditForm
                    selectedNode={selectedNode}
                    fieldList={fieldList}
                    visible={isModalShown}
                    onCreate={values => {
                        const newArr = queryOptions[0].filters;
                        for (let i = 0; i < fieldList.length; i++) {
                            if (values.field === fieldList[i].id) {
                                const value = (fieldList[i].dataType === 'int' || fieldList[i].dataType === 'dec') ? parseFloat(values.value) : values.value.toString();
                                newArr.push({ field: values.field, op: values.op, value: value, name: fieldList[i].fieldName });
                                break;
                            }
                        }
                        queryOptions[1]({ ...queryOptions[0], filters: newArr });
                        setIsModalShown(false);
                    }}
                    onCancel={() => {
                        setIsModalShown(false);
                    }}
                />
                <Tree
                    checkable={checkable}
                    onCheck={(checkedList) => { onCheck(checkedList); }}
                    checkedKeys={checkedList}
                    onRightClick={(info) => {
                        if (!('children' in info.node)) {
                            setIsModalShown(true);
                            setSelectedNode(info.node.key.toString());
                        }
                    }}
                >
                    {renderTreeNodes(makeTree(transformedList))}
                </Tree>
            </>
        );
    } else {
        return (
            <Tree>
                {renderTreeNodes(makeTree(transformedList))}
            </Tree>);

    }
};

const ValueEditForm: React.FunctionComponent<{ visible: boolean; onCreate: any; onCancel: any; fieldList: any; selectedNode: any }> = ({ visible, onCreate, onCancel, fieldList, selectedNode }) => {
    const [form] = Form.useForm();

    const newFieldOperations = [
        { label: '=', value: '=' },
        { label: '!=', value: '!=' },
        { label: '>', value: '>' },
        { label: '<', value: '<' },
        { label: 'exists', value: 'exists' },
        { label: 'count', value: 'count' },
        { label: 'derived', value: 'derived' }
    ];

    const fieldOptions: any[] = [];
    for (let i = 0; i < fieldList.length; i++) {
        fieldOptions.push({ label: fieldList[i].fieldName, value: fieldList[i].id, valueType: fieldList[i].valueType });
    }
    return (
        (
            <Modal
                visible={visible}
                title='Value Editior'
                okText='Create'
                cancelText='Cancel'
                onCancel={onCancel}
                onOk={() => {
                    form
                        .validateFields()
                        .then(values => {
                            values.field = selectedNode;
                            onCreate(values);
                        })
                        .catch(() => {
                            // NOOP
                        });
                }}
            >
                <Form
                    initialValues={{
                        field: fieldOptions.filter(el => el.value === selectedNode).length !== 0 ? fieldOptions.filter(el => el.value === selectedNode)[0].label : '',
                        op: '=',
                        value: ''
                    }}
                    form={form}
                    layout='vertical'
                    name='form_in_modal'
                // initialValues={person}
                >
                    <Form.Item
                        name='field'
                        label='field'
                    >
                        {selectedNode === '' ? null : <Input disabled={true} defaultValue={fieldOptions.filter(el => el.value === selectedNode)[0].label} />}
                    </Form.Item>
                    <Form.Item
                        name='op'
                        label='op'
                        rules={[
                            {
                                required: true,
                                message: 'Please input the value!'
                            }
                        ]}
                    >
                        <Select options={Object.values(newFieldOperations)} ></Select>
                    </Form.Item>
                    <Form.Item
                        name='value'
                        label='Value'
                        rules={[
                            {
                                required: true,
                                message: 'Please input the value!'
                            }
                        ]}
                    >
                        <Input />
                    </Form.Item>
                </Form>
            </Modal>
        )
    );
};

function constructPath(fieldPath: string, fieldList: any[]) {
    const newPath: any[] = [];
    for (let i = 0; i < fieldPath.length; i++) {
        if (fieldList.filter(el => el.fieldId === fieldPath[i]).length === 1) {
            newPath.push(fieldList.filter(el => el.fieldId === fieldPath[i])[0].fieldName);
        } else {
            newPath.push(fieldPath[i]);
        }
        newPath.push('>');
    }
    newPath.splice(newPath.length - 1, 1);
    return newPath.join('');
}
