import { FunctionComponent, useEffect, useState } from 'react';
import { useQuery, useMutation } from '@apollo/client/react/hooks';
import { CREATE_STANDARDIZATION, GET_STANDARDIZATION, GET_ONTOLOGY_TREE } from '@itmat-broker/itmat-models';
import { IStandardization } from '@itmat-broker/itmat-types';
import { DeleteOutlined, FrownTwoTone, SmileTwoTone, PlusOutlined } from '@ant-design/icons';
import LoadSpinner from '../../../reusable/loadSpinner';
import { generateCascader } from '../../../../utils/tools';
import css from './tabContent.module.css';
import { Button, Input, Select, notification, Space, Form, Cascader } from 'antd';
const { Option } = Select;

export const FieldManagementTabContentFetch: FunctionComponent<{ studyId: string }> = ({ studyId }) => {
    const { loading: getStandardizationLoading, error: getStandardizationError, data: getStandardizationData } = useQuery(GET_STANDARDIZATION, { variables: { studyId: studyId } });
    const { loading: getOntologyTreeLoading, error: getOntologyTreeError, data: getOntologyTreeData } = useQuery(GET_ONTOLOGY_TREE, {
        variables: {
            studyId: studyId,
            treeId: null
        }
    });
    const [createStandardization, {
        loading: editFieldLoading
    }] = useMutation(CREATE_STANDARDIZATION, {
        onCompleted: () => {
            notification.open({
                message: 'Success',
                description:
                    `Std for ${selectedStd.field} has been updated.`,
                icon: <SmileTwoTone twoToneColor='#4BB543' />
            });
        },
        onError: () => {
            notification.open({
                message: 'Failed',
                description:
                    `Field ${selectedStd.field.toString()} failed to update.`,
                icon: <FrownTwoTone twoToneColor='#FC100D' />
            });
        }
    });

    const [editMode, setEditMode] = useState(false);
    const [format, setFormat] = useState<string | undefined>(undefined);
    const [selectedStd, setSelectedStd] = useState<any>({
        id: '',
        studyId: studyId,
        type: format || '',
        field: [],
        path: [],
        stdRules: [],
        joinByKeys: [],
        deleted: null
    });
    const [form] = Form.useForm();
    useEffect(() => {
        form.setFieldsValue(selectedStd);
    }, [form, selectedStd]);
    if (getStandardizationLoading || getOntologyTreeLoading || editFieldLoading) {
        return <LoadSpinner />;
    }
    if (getStandardizationError || getOntologyTreeError) {
        return <p>
            An error occured, please contact your administrator
        </p>;
    }
    const availableFormats: string[] = Array.from(new Set(getStandardizationData.getStandardization.map(el => el.type)));
    const fieldPathOptions: any = [];
    getOntologyTreeData.getOntologyTree.filter(el => el.name === format)[0]?.routes.forEach(el => {
        generateCascader(el, fieldPathOptions, true);
    });
    return <div className={css.tab_page_wrapper}>

        <Select
            style={{ width: '20%' }}
            placeholder='Select Format'
            allowClear
            value={format}
            onSelect={(value: string) => {
                setFormat(value);
            }}
            showSearch
        >
            {
                availableFormats.map(el => <Option value={el}>{(el as string).toString()}</Option>)
            }
        </Select>
        <Cascader
            options={fieldPathOptions}
            placeholder={'Select Field'}
            onChange={(value) => {
                const searchedRoute: any = getOntologyTreeData.getOntologyTree
                    .filter(el => el.name === format)[0].routes?.filter(el => JSON.stringify(el.path.concat(el.name)) === JSON.stringify(value))[0];
                if (searchedRoute === undefined) {
                    return;
                }
                const searchedStd: IStandardization | undefined = getStandardizationData.getStandardization.filter(el => {
                    return JSON.stringify(el.field) === JSON.stringify(searchedRoute.field);
                })[0];
                if (searchedStd === undefined) {
                    return;
                }
                setSelectedStd({
                    ...searchedStd,
                    field: searchedStd.field,
                    path: searchedStd.path
                });
            }}
        />
        <Button onClick={() => {
            setEditMode(true);
        }}>Edit
        </Button>
        <Button onClick={() => {
            setEditMode(false);
        }}>Cancel
        </Button><br /><br />

        <Form
            form={form}
            name={'standard'}
            initialValues={selectedStd}
            onFinish={(value) => {
                console.log(value);
                const stdRules: any[] = [];
                [...value.stdRules].forEach(el => {
                    delete el.__typename;
                    delete el.id;
                    stdRules.push(el);
                });
                createStandardization({
                    variables: {
                        studyId: studyId,
                        standardization: {
                            type: selectedStd.type,
                            field: value.field,
                            path: value.path,
                            joinByKeys: value.joinByKeys,
                            stdRules: stdRules
                        }
                    }
                });
            }}
        >

            <Form.Item
                label='Field'
                name='field'
                rules={[
                    {
                        required: true,
                        message: 'Please input the field.'
                    }
                ]}
            >
                <Select mode='tags' disabled={!editMode} />
            </Form.Item>
            <Form.Item
                label='Join'
                name='joinByKeys'
                rules={[
                    {
                        required: false,
                        message: 'Please input the field.'
                    }
                ]}
            >
                <Select mode='tags' disabled={!editMode} />
            </Form.Item>
            <Form.Item
                label='Path'
                name='path'
                rules={[
                    {
                        required: true,
                        message: 'Please input the field.'
                    }
                ]}
            >
                <Select mode='tags' disabled={!editMode} />
            </Form.Item>
            <div style={{ gridArea: 'right' }}>
                <Form.List name='stdRules'>
                    {(fields, { add, remove }) => (
                        <>
                            {fields.map(({ key, name, ...restField }) => (
                                <Space key={key} style={{ display: 'flex', marginBottom: 8 }} align='baseline'>
                                    <Form.Item
                                        {...restField}
                                        name={[name, 'entry']}
                                        rules={[{ required: true, message: 'Entry' }]}
                                    >
                                        <Input placeholder='First Name' disabled={!editMode} />
                                    </Form.Item>
                                    <Form.Item
                                        {...restField}
                                        name={[name, 'source']}
                                        rules={[{ required: true, message: 'Source' }]}
                                    >
                                        <Select>
                                            <Option value='data'>Data</Option>
                                            <Option value='fieldDef'>Field</Option>
                                            <Option value='inc'>Increasement</Option>
                                            <Option value='reserved'>Reserved Key</Option>
                                            <Option value='value'>Value</Option>
                                        </Select>
                                    </Form.Item>
                                    <Form.Item
                                        {...restField}
                                        name={[name, 'parameter']}
                                        rules={[{ required: false, message: 'Parameter' }]}
                                    >
                                        <Input placeholder='Parameter' disabled={!editMode} />
                                    </Form.Item>
                                    <DeleteOutlined onClick={() => remove(name)} />
                                </Space>
                            ))}
                            <Form.Item>
                                <Button type='dashed' onClick={() => add()} block icon={<PlusOutlined />}>
                                    Add field
                                </Button>
                            </Form.Item>
                        </>
                    )}
                </Form.List>
            </div>
            {
                editMode ?
                    <Form.Item
                        wrapperCol={{
                            offset: 8,
                            span: 16
                        }}
                    >
                        <Button type='primary' htmlType='submit'>
                            Submit
                        </Button>
                    </Form.Item> : null
            }
        </Form>
    </div>;
};
