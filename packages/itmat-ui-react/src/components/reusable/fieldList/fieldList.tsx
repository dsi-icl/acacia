import { FunctionComponent } from 'react';
import { enumValueType, IFieldEntry } from '@itmat-broker/itmat-types';
import { Table, Tooltip } from 'antd';

export const FieldListSection: FunctionComponent<{ studyData?: any, onCheck?: any; checkedList?: string[]; checkable: boolean; fieldList: IFieldEntry[]; verbal?: boolean }> = ({ onCheck, checkedList, checkable, fieldList, verbal }) => {
    const possibleValuesColumns = [
        {
            title: 'Code',
            dataIndex: 'code',
            key: 'code',
            render: (__unused__value, record) => {
                return record.code;
            }
        },
        {
            title: 'Description',
            dataIndex: 'description',
            key: 'description',
            render: (__unused__value, record) => {
                return record.description;
            }
        }
    ];
    const columns = [
        {
            title: 'Field ID',
            dataIndex: 'fieldId',
            key: 'fieldId',
            render: (__unused__value, record) => {
                return record.fieldId;
            }
        },
        {
            title: 'Field Name',
            dataIndex: 'fieldName',
            key: 'fieldName',
            ellipsis: true,
            render: (__unused__value, record) => (
                <Tooltip placement='topLeft' title={record.fieldName}>
                    {record.fieldName}
                </Tooltip>
            )
        },
        {
            title: 'Table Name',
            dataIndex: 'tableName',
            key: 'tableName',
            render: (__unused__value, record) => {
                return record.tableName;
            }
        },
        {
            title: 'Data Type',
            dataIndex: 'dataType',
            key: 'dataType',
            render: (__unused__value, record) => {
                if (record.dataType === enumValueType.CATEGORICAL) {
                    return <Tooltip placement='topLeft' title={<Table
                        columns={possibleValuesColumns}
                        dataSource={record.possibleValues}
                    >
                    </Table>}>
                        {record.dataType}
                    </Tooltip>;
                } else {
                    return <span>{record.dataType}</span>;
                }
            }
        },
        {
            title: 'Unit',
            dataIndex: 'unit',
            key: 'unit',
            render: (__unused__value, record) => {
                return record.unit;
            }
        },
        {
            title: 'Comments',
            dataIndex: 'comments',
            key: 'comments',
            render: (__unused__value, record) => {
                return record.comments;
            }
        }
    ];
    if (checkable) {
        return (<Table
            rowKey={(rec) => rec.id}
            pagination={
                {
                    defaultPageSize: 50,
                    showSizeChanger: true,
                    pageSizeOptions: ['20', '50', '100', '200', '2000'],
                    defaultCurrent: 1,
                    showQuickJumper: true
                }
            }
            rowSelection={{
                type: 'checkbox',
                onChange: (selectedRows) => {
                    onCheck(selectedRows);
                },
                selectedRowKeys: checkedList
            }}
            columns={verbal ? columns : columns.slice(0, 2)}
            dataSource={[...fieldList].sort((a, b) => a.fieldId.localeCompare(b.fieldId))}
            size='middle'
        ></Table>);
    } else {
        return (<Table
            rowKey={(rec) => rec.id}
            pagination={
                {
                    defaultPageSize: 50,
                    showSizeChanger: true,
                    pageSizeOptions: ['20', '50', '100', '200', '2000'],
                    defaultCurrent: 1,
                    showQuickJumper: true
                }
            }
            columns={verbal ? columns : columns.slice(0, 2)}
            dataSource={[...fieldList].sort((a, b) => a.fieldId.localeCompare(b.fieldId))}
            size='middle'
        ></Table>);
    }
};
