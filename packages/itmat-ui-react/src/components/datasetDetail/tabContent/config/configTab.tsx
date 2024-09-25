import { enumConfigType, enumStudyBlockColumnValueType, IStudy } from '@itmat-broker/itmat-types';
import { FunctionComponent } from 'react';
import css from './configContent.module.css';
import { Button, Form, Input, List, message, Select, Table } from 'antd';
import { trpc } from '../../../../utils/trpc';
import LoadSpinner from '../../../reusable/loadSpinner';
import { MinusOutlined, PlusOutlined } from '@ant-design/icons';
import Column from 'antd/es/table/Column';

export const ConfigTabContent: FunctionComponent<{ study: IStudy }> = ({ study }) => {
    const whoAmI = trpc.user.whoAmI.useQuery();
    const getStudyConfig = trpc.config.getConfig.useQuery({
        configType: enumConfigType.STUDYCONFIG,
        key: study.id,
        useDefault: true
    });
    const getStudyFields = trpc.data.getStudyFields.useQuery({ studyId: study.id });
    const editConfig = trpc.config.editConfig.useMutation({
        onSuccess: () => {
            void message.success('Config updated successfully.');
        },
        onError: (error) => {
            void message.error('An error occured: ' + error);
        }
    });

    const [form] = Form.useForm();

    if (whoAmI.isLoading || getStudyConfig.isLoading || getStudyFields.isLoading) {
        return <LoadSpinner />;
    }

    if (whoAmI.isError || getStudyConfig.isError || getStudyFields.isError) {
        return <p>An error occured.</p>;
    }

    const secondLevelColumns = [{
        title: 'Title',
        dataIndex: 'title',
        key: 'title',
        render: (_, record, index) => (
            <Form.Item name={[index, 'title']} noStyle>
                <Input />
            </Form.Item>
        )
    }, {
        title: 'Property',
        dataIndex: 'property',
        key: 'property',
        render: (_, record, index) => (
            <Form.Item name={[index, 'property']} noStyle>
                <Input />
            </Form.Item>
        )
    }, {
        title: 'Type',
        dataIndex: 'type',
        key: 'type',
        render: (_, record, index) => (
            <Form.Item name={[index, 'type']} noStyle>
                <Select>
                    {
                        Object.keys(enumStudyBlockColumnValueType).map(el => <Select.Option value={el}>{el}</Select.Option>)
                    }
                </Select>
            </Form.Item>
        )
    }];

    const firstLevelColumns = [{
        title: 'Title',
        dataIndex: 'title',
        key: 'title',
        width: '10%',
        render: (_, record, index) => (
            <Form.Item name={[index, 'title']} noStyle>
                <Input />
            </Form.Item>
        )
    }, {
        title: 'Field IDs',
        dataIndex: 'fieldIds',
        key: 'fieldIds',
        width: '40%',
        render: (_, record, index) => (
            <Form.Item name={[index, 'fieldIds']} noStyle>
                <Select mode='multiple'>
                    {
                        getStudyFields.data.map(el => <Select.Option value={el.fieldId}>{el.fieldName}</Select.Option>)
                    }
                </Select>
            </Form.Item>
        )
    }, {
        title: 'Default File Columns',
        dataIndex: 'defaultFileColumns',
        key: 'defaultFileColumns',
        width: '50%',
        render: (_, record, index) => (
            <Form.List name={[index, 'defaultFileColumns']}>
                {(fields, { add, remove }) => (
                    <Table
                        dataSource={fields}
                        pagination={false}
                        footer={() => (
                            <Button onClick={() => add({ property: undefined, values: [] })}>
                                <PlusOutlined /> Add File Column
                            </Button>
                        )}
                    >
                        {secondLevelColumns.map((col) => (
                            <Column
                                key={col.key}
                                title={col.title}
                                dataIndex={col.dataIndex}
                                render={(value, row, secondIndex) => (
                                    <Form.Item
                                        name={[secondIndex, col.dataIndex]}
                                        noStyle
                                    >
                                        {col.render(value, row, secondIndex)}
                                    </Form.Item>
                                )}
                            />
                        ))}
                        <Column
                            title="Action"
                            render={(_, __, secondIndex) => (
                                <Button
                                    icon={<MinusOutlined />}
                                    shape="circle"
                                    onClick={() => remove(secondIndex)}
                                />
                            )}
                        />
                    </Table>
                )}
            </Form.List>
        )
    }];

    return <div className={`${css.tab_page_wrapper} fade_in`}>
        <div className={css.page_container}>
            <List
                header={
                    <div className={css['overview-header']} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div className={css['overview-header']} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                <div className={css['overview-icon']}></div>
                                <div>Config</div>
                            </div>
                        </div>
                        <div>
                            <Button type='primary' onClick={() => {
                                const values = form.getFieldsValue();
                                const variables = {
                                    ...getStudyConfig.data.properties,
                                    ...values,
                                    life: {
                                        createdTime: Date.now(),
                                        createdUser: whoAmI.data.id,
                                        deletedTime: null,
                                        deletedUser: null
                                    },
                                    metadata: {}
                                };
                                editConfig.mutate({
                                    configType: enumConfigType.STUDYCONFIG,
                                    key: study.id,
                                    properties: variables
                                });
                            }}>Submit Change</Button>
                        </div>
                    </div>
                }
            >
                <List.Item>
                    <Form
                        initialValues={getStudyConfig.data.properties}
                        form={form}
                    >
                        <Form.Item
                            label='Default Maximum File Size'
                            name='defaultMaximumFileSize'
                        >
                            <Input />
                        </Form.Item>
                        <Form.List name="defaultFileBlocks">
                            {(fileBlocks, { add, remove }) => (
                                <Table
                                    pagination={false}
                                    scroll={{ x: 2000 }} // Set a specific width for scrolling instead of max-content
                                    dataSource={fileBlocks}
                                    footer={() => (
                                        <Button onClick={() => add({ title: undefined, fieldIds: [], defaultFileColumns: [], defaultFileColumnsPropertyColor: '#ed0722' })}>
                                            <PlusOutlined /> Add File Block
                                        </Button>
                                    )}
                                >
                                    {firstLevelColumns.map((col) => (
                                        <Column
                                            key={col.key}
                                            title={col.title}
                                            dataIndex={col.dataIndex}
                                            render={(value, row, index) => (
                                                <Form.Item name={[index, col.dataIndex]} noStyle>
                                                    {col.render(value, row, index)}
                                                </Form.Item>
                                            )}
                                            width={col.width} // Set width here
                                        />
                                    ))}
                                    <Column
                                        title="Action"
                                        render={(_, __, index) => (
                                            <Button icon={<MinusOutlined />} shape="circle" onClick={() => remove(index)} />
                                        )}
                                        width={80} // Keep action column relatively small
                                    />
                                </Table>
                            )}
                        </Form.List>
                    </Form>
                </List.Item>
            </List><br />
        </div>;
    </div>;
};
