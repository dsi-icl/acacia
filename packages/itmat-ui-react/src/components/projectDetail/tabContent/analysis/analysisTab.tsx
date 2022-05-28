import { statisticsTypes, analysisTemplate, options } from '../utils/defaultParameters';
import { get_t_test, get_z_test, mannwhitneyu, findDmField, generateCascader } from '../../../../utils/tools';
import * as React from 'react';
import { useQuery, useLazyQuery } from '@apollo/client/react/hooks';
import { GET_STUDY_FIELDS, GET_PROJECT, GET_DATA_RECORDS, IFieldEntry, IProject, enumValueType, GET_ONTOLOGY_TREE, IOntologyTree, IOntologyRoute } from 'itmat-commons';
import LoadSpinner from '../../../reusable/loadSpinner';
import { Subsection, SubsectionWithComment } from '../../../reusable/subsection/subsection';
import css from './tabContent.module.css';
import exportFromJSON from 'export-from-json';
import { Select, Form, Modal, Divider, Slider, Table, Button, Typography, Input, Tag, Popconfirm, message, Tooltip, List, Cascader } from 'antd';
import { Heatmap, Violin, Column } from '@ant-design/plots';
import { PlusOutlined, MinusCircleOutlined, CopyOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useParams } from 'react-router-dom';
const { Option } = Select;
const { Paragraph, Text } = Typography;
const { SHOW_CHILD } = Cascader;

export const AnalysisTabContent: React.FunctionComponent<{ studyId: string }> = ({ studyId }) => {
    const { projectId } = useParams();

    const { loading: getStudyFieldsLoading, error: getStudyFieldsError, data: getStudyFieldsData } = useQuery(GET_STUDY_FIELDS, { variables: { studyId: studyId, projectId: projectId } });
    const { loading: getProjectLoading, error: getProjectError, data: getProjectData } = useQuery(GET_PROJECT, { variables: { projectId: projectId, admin: false } });
    const [getDataRecords, { loading: getDataRecordsLoading, data: getDataRecordsData }] = useLazyQuery(GET_DATA_RECORDS, {
        fetchPolicy: 'network-only'
    });
    const [filters, setFilters] = React.useState<any>({
        groups: [],
        comparedFields: []
    });
    const { loading: getOntologyTreeLoading, error: getOntologyTreeError, data: getOntologyTreeData } = useQuery(GET_ONTOLOGY_TREE, {
        variables: {
            studyId: studyId,
            projectId: projectId,
            treeId: null
        }
    });
    if (getStudyFieldsLoading || getProjectLoading || getDataRecordsLoading || getOntologyTreeLoading) {
        return <LoadSpinner />;
    }
    if (!projectId || getStudyFieldsError || getProjectError || getOntologyTreeError) {
        return <div className={`${css.tab_page_wrapper} ${css.both_panel} ${css.upload_overlay}`}>
            A error occured, please contact your administrator
        </div>;
    }
    const fieldPathOptions: any = [];
    getOntologyTreeData.getOntologyTree[0]?.routes.forEach(el => {
        generateCascader(el, fieldPathOptions, true);
    });

    const genderField: any = findDmField(getOntologyTreeData.getOntologyTree[0], getStudyFieldsData.getStudyFields, 'SEX');
    const raceField: any = findDmField(getOntologyTreeData.getOntologyTree[0], getStudyFieldsData.getStudyFields, 'RACE');
    const ageField: any = findDmField(getOntologyTreeData.getOntologyTree[0], getStudyFieldsData.getStudyFields, 'AGE');
    const siteField: any = findDmField(getOntologyTreeData.getOntologyTree[0], getStudyFieldsData.getStudyFields, 'SITE');
    return (<div className={css.tab_page_wrapper}>
        <div className={css.scaffold_wrapper}></div>
        <FilterSelector filtersTool={[filters, setFilters]} fields={getStudyFieldsData.getStudyFields} project={getProjectData.getProject} query={getDataRecords}
            ontologyTree={getOntologyTreeData.getOntologyTree[0]} fieldPathOptions={fieldPathOptions} dmFields={[genderField, raceField, ageField, siteField]} />
        <ResultsVisualization project={getProjectData.getProject} fields={getStudyFieldsData.getStudyFields} data={divideResults(filters, getDataRecordsData?.getDataRecords.data, getStudyFieldsData.getStudyFields,
            [genderField, raceField, ageField, siteField])} />
        <div />
    </div>);
};

const FilterSelector: React.FunctionComponent<{ filtersTool: any, fields: IFieldEntry[], project: IProject, query: any, ontologyTree: IOntologyTree, fieldPathOptions: any, dmFields: any[] }> = ({ filtersTool, fields, project, query, ontologyTree, fieldPathOptions, dmFields }) => {
    const [isModalOn, setIsModalOn] = React.useState(false);
    const [isTemplateModalOn, setIsTemplateModalOn] = React.useState(false);
    const [templateType, setTemplateType] = React.useState<string | undefined>('NA');
    const [currentGroupIndex, setCurrentGroupIndex] = React.useState(-1);
    const [form] = Form.useForm();
    React.useEffect(() => {
        form.setFieldsValue(formInitialValues(form, filtersTool[0], currentGroupIndex));
    });

    const [genderField, raceField] = dmFields;
    return (<div className={css.scaffold_wrapper}>
        <div>
            <Subsection title='Introduction'>
                <Typography>
                    <Paragraph>
                        The <Text strong>ANALYSIS</Text> tab allows users to obtain several statistics for a specific group of subjects. Users can also compare these statistics among different groups of subjects.
                    </Paragraph>
                    <List
                        header={<div>Follow the steps to start an analysis</div>}
                        // footer={<div>Footer</div>}
                        bordered
                        dataSource={[
                            '1. Create groups based on several criteria. These criteria include demographics (age, race, sex, etc.), ' +
                            'and general variables that can be filtered by a range;',
                            '2. Click the Analysis button to do an analysis;',
                            '3. View the analytical results. Users can select on of the two statistics (T test, Z test), and ' +
                            'download the original data of the results.'
                        ]}
                        renderItem={item => (
                            <List.Item>
                                <Typography.Text mark></Typography.Text> {item}
                            </List.Item>
                        )}
                    />
                </Typography><br />
                <Button onClick={() => {
                    setIsModalOn(true);
                    setCurrentGroupIndex(-1);
                }}>Create a new group</Button>
                <Button onClick={() => {
                    if (currentGroupIndex === -1) {
                        return;
                    } else {
                        const newFilters = { ...filtersTool[0] };
                        newFilters.groups = [...filtersTool[0].groups, filtersTool[0].groups[currentGroupIndex]];
                        filtersTool[1](newFilters);
                    }
                }}>Paste the {currentGroupIndex.toString()} group</Button>
                <Button onClick={() => {
                    setIsTemplateModalOn(true);
                }}>Select a template</Button>
                <Button style={{ float: 'right' }} type='primary' onClick={() => {
                    query({
                        variables: {
                            studyId: project.studyId,
                            projectId: project.id,
                            queryString: {
                                ...combineFilters(fields, filtersTool[0], dmFields)
                            }
                        }
                    });
                }}>Analysis</Button>
            </Subsection>
        </div>
        <div>
            <Subsection title='Data Selection'>
                <Modal title='Filters' visible={isTemplateModalOn}
                    width={1000}
                    onOk={() => {
                        setIsTemplateModalOn(false);
                        if (templateType === undefined) {
                            return;
                        } else {
                            const newFilters = analysisTemplate[templateType];
                            delete newFilters.description;
                            filtersTool[1](newFilters);
                            setCurrentGroupIndex(newFilters.groups.length - 1);
                        }
                    }}
                    onCancel={() => {
                        setIsTemplateModalOn(false);
                    }}
                >
                    <Select
                        style={{ width: '100%' }}
                        placeholder='Select One Template'
                        onChange={(value) => {
                            setTemplateType(value);
                        }}
                    >
                        {
                            Object.keys(analysisTemplate).map(el => <Option value={el} >{analysisTemplate[el].description}</Option>)
                        }
                    </Select>
                </Modal>
                <Modal title='Filters' visible={isModalOn}
                    width={1000}
                    onOk={() => {
                        const data = { ...form.getFieldsValue(true) };
                        for (let i = 0; i < data.filters.length; i++) {
                            const route: IOntologyRoute | undefined = ontologyTree.routes?.filter(el => {
                                return JSON.stringify(el.path.concat(el.name)) === JSON.stringify(data.filters[i].field);
                            })[0];
                            if (route === undefined) {
                                data.filters.splice(i, 1);
                            } else {
                                data.filters[i].field = route.field[0].replace('$', '');
                            }
                        }
                        const newFilters = { ...filtersTool[0] };
                        if (currentGroupIndex === -1) {
                            newFilters.groups.push(data);
                            setCurrentGroupIndex(newFilters.groups.length - 1);
                            filtersTool[1](newFilters);
                        } else {
                            newFilters.groups[currentGroupIndex] = data;
                            filtersTool[1](newFilters);
                        }
                    }}
                    onCancel={() => {
                        setIsModalOn(false);
                    }}
                >
                    <Form
                        layout='horizontal'
                        form={form}
                    >
                        <Form.Item label='Select Visit' name='visit'
                            labelAlign={'left'}
                            rules={[
                                {
                                    required: true
                                }
                            ]}
                        >
                            <Select
                                style={{ width: '100%' }}
                                placeholder='Select Visit'
                            >
                                {[...project.summary.visits].filter(el => el.toString() !== '0').sort((a, b) => { return parseFloat(a) - parseFloat(b); }).map((es) => {
                                    return <Option value={es}>{es.toString()}</Option>;
                                })}
                            </Select>
                        </Form.Item>
                        <Form.Item label='Select Race' name='race'
                            labelAlign={'left'}
                        >
                            <Select
                                style={{ width: '100%' }}
                                placeholder='Select Race'
                                mode='multiple'
                            >
                                {
                                    (raceField?.possibleValues || []).map(el => {
                                        return <Option value={el.code}>{el.description.toString()}</Option>;
                                    })
                                }
                            </Select>
                        </Form.Item>
                        <Form.Item label='Select Gender' name='genderID'
                            labelAlign={'left'}
                        >
                            <Select
                                style={{ width: '100%' }}
                                placeholder='Select Gender'
                                mode='multiple'
                            >
                                {
                                    (genderField?.possibleValues || []).map(el => {
                                        return <Option value={el.code}>{el.description.toString()}</Option>;
                                    })
                                }
                            </Select>
                        </Form.Item>
                        <Form.Item label='Input Site' name='siteID'
                            labelAlign={'left'}
                        >
                            <Input />
                        </Form.Item>
                        <Form.Item label='Select Age' name='age'
                            labelAlign={'left'}
                        >
                            <Slider
                                range={true}
                                defaultValue={[0, 100]}
                                disabled={false}
                            />
                        </Form.Item>
                        <Form.List name='filters'>
                            {(filters, { add, remove }) => {
                                return (
                                    <div>
                                        <Divider plain>Variable Filter <PlusOutlined onClick={() => add()} /></Divider>
                                        {
                                            filters.length > 0 ?
                                                <Table
                                                    scroll={{ x: 'max-content' }}
                                                    pagination={false}
                                                    columns={variableFilterColumns(fields, remove, fieldPathOptions)}
                                                    dataSource={filters}
                                                    size='middle'
                                                ></Table>
                                                :
                                                null
                                        }
                                    </div>
                                );
                            }}
                        </Form.List>
                    </Form>
                </Modal>
                <Table
                    scroll={{ x: 'max-content' }}
                    // rowKey={(rec) => rec.id}
                    pagination={false}
                    columns={filterTableColumns(fields, [genderField, raceField], filtersTool, setIsModalOn, setCurrentGroupIndex)}
                    dataSource={[...(filtersTool[0].groups || [])]}
                    size='middle'
                ></Table>
                <Cascader
                    style={{ width: '100%' }}
                    options={fieldPathOptions}
                    onChange={(value) => {
                        const newFields: string[] = [];
                        value.forEach(el => {
                            const route: IOntologyRoute | undefined = ontologyTree.routes?.filter(es => {
                                return JSON.stringify(es.path.concat(es.name)) === JSON.stringify(el);
                            })[0];
                            if (route !== undefined) {
                                newFields.push(route.field[0].replace('$', ''));
                            }
                        });
                        const newFilters = { ...filtersTool[0] };
                        newFilters.comparedFields = [...newFields];
                        filtersTool[1](newFilters);
                    }}
                    multiple
                    maxTagCount='responsive'
                    showCheckedStrategy={SHOW_CHILD}
                />
            </Subsection>
        </div>
    </div>);
};

const ResultsVisualization: React.FunctionComponent<{ project: IProject, fields: IFieldEntry[], data: any }> = ({ project, fields, data }) => {
    const [statisticsType, setStatisticsType] = React.useState('ttest');
    const [signifianceLevel, setSignigicanceLevel] = React.useState<number | undefined>(undefined);
    if (data === undefined) {
        return null;
    }

    const columns = [
        {
            title: 'Field Index',
            dataIndex: 'field',
            key: 'field',
            render: (__unused__value, record) => {
                return record.field;
            }
        },
        {
            title: 'Data Summary',
            dataIndex: 'graph',
            key: 'graph',
            render: (__unused__value, record) => {
                const fieldDef = fields.filter(el => el.fieldId === record.field)[0];
                if ([enumValueType.DECIMAL, enumValueType.INTEGER].includes(fieldDef.dataType)) {
                    return (<div>
                        <Violin
                            data={record.dataForGraph}
                            xField={'x'}
                            yField={'y'}
                        />
                    </div>);
                } else if ([enumValueType.BOOLEAN, enumValueType.CATEGORICAL].includes(fieldDef.dataType)) {
                    return (<div>
                        <Column
                            data={record.dataForGraph}
                            xField={'x'}
                            yField={'y'}
                            seriesField={'type'}
                            isPercent={true}
                            isStack={true}
                            interactions={[
                                { type: 'element-highlight-by-color' },
                                { type: 'element-link' }
                            ]}
                        />
                    </div>);
                } else {
                    return null;
                }
            }
        },
        {
            title: 'Statistics Score',
            dataIndex: 'score',
            key: 'score',
            render: (__unused__value, record) => {
                return <Heatmap
                    data={record.score}
                    xField={'xLabel'}
                    yField={'yLabel'}
                    colorField={'score'}
                    legend={{
                        layout: 'horizontal',
                        position: 'bottom',
                        offsetY: 5,
                        min: Math.min(...record.score.map(el => el.score)),
                        max: Math.max(...record.score.map(el => el.score))
                    }}
                />;
            }
        },
        {
            title: <>
                Statistics Pvalue
                <Select
                    placeholder='Significance Level'
                    style={{ float: 'right' }}
                    value={signifianceLevel}
                    onChange={(value) => setSignigicanceLevel(value)}
                >
                    <Option value={0.05} >0.05</Option>
                    <Option value={0.01} >0.01</Option>
                </Select>
            </>,
            dataIndex: 'pvalue',
            key: 'pvalue',
            render: (__unused__value, record) => {
                return signifianceLevel !== undefined ? (<Heatmap
                    data={record.pvalue}
                    xField={'xLabel'}
                    yField={'yLabel'}
                    colorField={'pvalue'}
                    sizeField={'pvalue'}
                    shape={'rect'}
                    legend={{
                        layout: 'horizontal',
                        position: 'bottom',
                        offsetY: 5,
                        value: [0.0, 1.0],
                        min: 0,
                        max: 1
                    }}
                    pattern={({ pvalue }) => {
                        if (signifianceLevel >= pvalue) {
                            return {
                                type: 'square',
                                cfg: {
                                    backgroundColor: 'orange', // custom color
                                }
                            };
                        } else {
                            return {
                                type: 'square',
                                cfg: {
                                    backgroundColor: 'white', // custom color
                                }
                            };
                        }
                    }}
                />) : (<Heatmap
                    data={record.pvalue}
                    xField={'xLabel'}
                    yField={'yLabel'}
                    colorField={'pvalue'}
                    sizeField={'pvalue'}
                    shape={'rect'}
                    legend={{
                        layout: 'horizontal',
                        position: 'bottom',
                        offsetY: 5,
                        value: [0.0, 1.0],
                        min: 0,
                        max: 1
                    }}
                />);
            }
        },
    ];
    return (<div>
        <SubsectionWithComment title='Results' comment={<>
            <Button style={{ float: 'right' }} onClick={() => {
                const fileName = 'analyticalResults-v'.concat(project.dataVersion?.version.toString() || '').concat('.json');
                const exportType = exportFromJSON.types.json;
                exportFromJSON({ data, fileName, exportType });
            }}>Export</Button>
            <Select
                onChange={(value) => {
                    setStatisticsType(value);
                }}
                value={statisticsType}
                style={{ float: 'right' }}
                placeholder='Select Statistics'
            >

                {
                    statisticsTypes.map(el => <Option value={el}>{el}</Option>)
                }

            </Select>
        </>}>
            <Table
                scroll={{ x: 'max-content' }}
                pagination={false}
                columns={columns}
                dataSource={data.map(el => {
                    return {
                        ...el,
                        score: el[statisticsType].score,
                        pvalue: el[statisticsType].pvalue
                    };
                })}
                size='middle'
            ></Table>
        </SubsectionWithComment>
    </div>);
};

function variableFilterColumns(fields: IFieldEntry[], remove: any, fieldPathOptions: any) {
    return [
        {
            title: 'Field',
            width: '50%',
            dataIndex: 'field',
            key: 'field',
            align: 'center' as const,
            render: (__unused__value, __unused__record, index) => {
                return (
                    <Form.Item
                        name={[index, 'field']}
                        rules={[{ required: true }]}
                    >
                        <Cascader
                            options={fieldPathOptions}
                            placeholder={'Select Field'}
                        />
                    </Form.Item>
                );
            }
        },
        {
            title: 'Op',
            width: '20%',
            dataIndex: 'op',
            key: 'op',
            align: 'center' as const,
            render: (__unused__value, __unused__record, index) => {
                return (
                    <Form.Item
                        name={[index, 'op']}
                        rules={[{ required: true }]}
                    >
                        <Select placeholder={'Select Operation'}>
                            {
                                options.ops.map(el => {
                                    return <Select.Option value={el}>{el}</Select.Option>;
                                })
                            }
                        </Select>
                    </Form.Item>
                );
            }
        },
        {
            title: 'Field',
            width: '20%',
            dataIndex: 'field',
            key: 'field',
            align: 'center' as const,
            render: (__unused__value, __unused__record, index) => {
                return (
                    <Form.Item
                        name={[index, 'value']}
                        rules={[
                            {
                                required: true
                            }
                        ]}
                    >
                        <Input placeholder='Input threshold' />
                    </Form.Item>
                );
            }
        },
        {
            title: 'Delete',
            width: '10%',
            dataIndex: 'delete',
            key: 'delete',
            align: 'center' as const,
            render: (__unused__value, record, __unused__index) => {
                return (
                    <MinusCircleOutlined onClick={() => remove(record.name)} />
                );
            }
        }
    ];
}

function filterTableColumns(fields: IFieldEntry[], dmFields: any[], filtersTool?: any, setIsModalOn?: any, setCurrentGroupIndex?: any) {
    if (filtersTool[0].groups.length === 0) {
        return [];
    }
    const [genderField, raceField] = dmFields;
    const columns = [
        {
            title: 'Group Index',
            dataIndex: 'index',
            key: 'index',
            render: (__unused__value, __unused__record, index) => {
                return index.toString();
            }
        },
        {
            title: 'Visit',
            dataIndex: 'visit',
            key: 'visit',
            render: (__unused__value, record) => {
                return <Tag color={options.tagColors.visit} >{record.visit}</Tag>;
            }
        }
    ];
    if (filtersTool[0] !== undefined) {
        if (filtersTool[0].groups.some(el => el.race.length !== 0)) {
            columns.push({
                title: 'Race',
                dataIndex: 'race',
                key: 'race',
                render: (__unused__value, record) => {
                    return <div>
                        {
                            record.race.map(el => <Tag color={options.tagColors.race} >{raceField?.possibleValues?.filter(ed => ed.code === el.toString())[0].description}</Tag>)
                        }
                    </div>;
                }
            });
        }
    }
    if (filtersTool[0] !== undefined) {
        if (filtersTool[0].groups.some(el => el.genderID.length !== 0)) {
            columns.push({
                title: 'Sex',
                dataIndex: 'sex',
                key: 'sex',
                render: (__unused__value, record) => {
                    return <div>
                        {
                            record.genderID.map(el => <Tag color={options.tagColors.race} >{genderField?.possibleValues?.filter(ed => ed.code === el.toString())[0].description}</Tag>)
                        }
                    </div>;
                }
            });
        }
    }
    if (filtersTool[0] !== undefined) {
        if (filtersTool[0].groups.some(el => el.mh.length !== 0)) {
            columns.push({
                title: 'Medical History',
                dataIndex: 'mh',
                key: 'mh',
                render: (__unused__value, record) => {
                    return <div>
                        <Tooltip title={record.mh?.map(el => {
                            const field = fields.filter(es => es.fieldId === el)[0];
                            return <Tag color={options.tagColors.mh} >{field.fieldName.toString()}</Tag>;
                        })}>
                            {record.mh.length.toString()}
                        </Tooltip>
                    </div>;
                }
            });
        }
    }
    if (filtersTool[0] !== undefined) {
        if (filtersTool[0].groups.some(el => (el.age[0] !== 0 || el.age[1] !== 100))) {
            columns.push({
                title: 'Age',
                dataIndex: 'age',
                key: 'age',
                render: (__unused__value, record) => {
                    return record.age.join('~');
                }
            });
        }
    }
    if (filtersTool[0] !== undefined) {
        if (filtersTool[0].groups.some(el => el.filters.length !== 0)) {
            columns.push({
                title: 'Field Filters',
                dataIndex: 'filters',
                key: 'filters',
                render: (__unused__value, record) => {
                    if (record.filters === undefined) {
                        return null;
                    }
                    const filterFields: string[] = Array.from(new Set(record.filters.map(el => {
                        const field: any = fields.filter(es => es.fieldId === el.field)[0];
                        return field.fieldId.concat('-').concat(field.fieldName).concat(' ').concat(el.op).concat(' ').concat(el.value);
                    })));
                    return <div>
                        {
                            filterFields.map(el => <Tag color={options.tagColors.filters} >{el.toString()}</Tag>)
                        }
                    </div>;
                }
            });
        }
    }
    if (setIsModalOn !== undefined && setCurrentGroupIndex !== undefined) {
        columns.push({
            title: 'Copy',
            dataIndex: 'copy',
            key: 'copy',
            render: (__unused__value, record, index) => {
                return <div>
                    <CopyOutlined key='copy' onClick={() => {
                        setCurrentGroupIndex(index);
                    }} />
                </div>;
            }
        });
        columns.push({
            title: 'Edit',
            dataIndex: 'edit',
            key: 'edit',
            render: (__unused__value, __unused__record, index) => {
                return <div>
                    <EditOutlined key='edit' onClick={() => {
                        setCurrentGroupIndex(index);
                        setIsModalOn(true);
                    }} />
                </div>;
            }
        });
        columns.push({
            title: 'Delete',
            dataIndex: 'delete',
            key: 'delete',
            render: (__unused__value, __unused__record, index) => {
                return <div>
                    <Popconfirm
                        title='Are you sure to delete this group?'
                        onConfirm={() => {
                            setCurrentGroupIndex(index);
                            const tmpArr = { ...filtersTool[0] };
                            tmpArr.groups.splice(index, 1);
                            filtersTool[1](tmpArr);
                        }}
                        onCancel={() => {
                            message.error('Cancelled!');
                        }}
                        okText='Yes'
                        cancelText='No'
                    >
                        <DeleteOutlined key='delete' />
                    </Popconfirm>
                </div>;
            }
        });
    }
    return columns;
}

function formInitialValues(form: any, filters: any, index: number) {
    if (index === -1) {
        return {
            visit: null,
            race: [],
            siteID: [],
            genderID: [],
            age: [0, 100],
            mh: [],
            filters: []
        };
    } else {
        return filters.groups[index];
    }
}

// // we sent the union of the filters as the filters in the request body
function combineFilters(fields: IFieldEntry[], filters: any, dmFields: any[]) {
    const queryString: any = {};
    queryString.data_requested = Array.from(new Set((filters.groups.map(el => el.filters).flat().map(es => es.field).concat(filters.comparedFields)
        .concat(dmFields.filter(el => (el !== undefined && el !== null)).map(el => el.fieldId)))));
    queryString.newFields = [];
    queryString.cohort = [];
    for (const field of dmFields) {
        if (field === undefined || field === null) {
            continue;
        }
        queryString.cohort.push([{ field: 'm_visitId', op: '=', value: field.visitRange[0] || '0' }]);
    }
    queryString.format = 'grouped';
    queryString.subjects_requested = null;
    for (const eachVisit of Array.from(new Set(filters.groups.map(el => el.visit)))) {
        queryString.cohort.push([{
            field: 'm_visitId',
            op: '=',
            value: eachVisit
        }]);
    }
    return queryString;
}

function divideResults(filters, results, fields, dmFields: any[]) {
    if (filters === undefined || results === undefined || fields === undefined) {
        return;
    }
    const data: any = [];
    const dms: any = {
        genderID: dmFields[0],
        race: dmFields[1],
        age: dmFields[2],
        siteID: dmFields[3],
    };
    filters.comparedFields.forEach(el => {
        const fieldDef: IFieldEntry = fields.filter(ek => ek.fieldId === el)[0];
        if (![enumValueType.DECIMAL, enumValueType.INTEGER, enumValueType.CATEGORICAL, enumValueType.BOOLEAN].includes(fieldDef.dataType)) {
            return;
        }
        if (fieldDef.tableName === 'Participants') {
            return;
        }
        const dataClip: any = {};
        dataClip.field = el;
        dataClip.data = {};
        filters.groups.forEach((es, index) => {
            if (fieldDef === undefined) {
                return;
            }
            dataClip.data['Group-'.concat(index.toString())] = [];
            if (results[el] === undefined || results[el][es.visit] === undefined) {
                return;
            }
            const dataByVisit = results[el][es.visit]?.data;
            // check demographics
            let valid;
            for (let i = 0; i < dataByVisit.length; i++) {
                valid = true;
                for (const key of Object.keys(dms)) {
                    if (key === 'visit') {
                        continue;
                    }
                    if (es[key].length === 0) {
                        continue;
                    }
                    if (key !== 'age') {
                        if (!es[key].includes(results[dms[key]?.fieldId][dms[key]?.visitRange[0]].data[i])) {
                            valid = false;
                            break;
                        }
                    } else if (key === 'age') {
                        if (!(es[key][0] <= results[dms[key]?.fieldId][dms[key]?.visitRange[0]].data[i] && es[key][1] >= results[dms[key]?.fieldId][dms[key]?.visitRange[0]].data[i])) {
                            valid = false;
                            break;
                        }
                    }
                }

                // check filters
                for (const eachFilter of es.filters) {
                    switch (eachFilter.op) {
                        case '=': {
                            if (results[eachFilter.field][es.visit].data[i] !== eachFilter.value) {
                                valid = false;
                            }
                            break;
                        }
                        case '!=': {
                            if (results[eachFilter.field][es.visit].data[i] === eachFilter.value) {
                                valid = false;
                            }
                            break;
                        }
                        case '<': {
                            if (results[eachFilter.field][es.visit].data[i] >= eachFilter.value) {
                                valid = false;
                            }
                            break;
                        }
                        case '>': {
                            if (results[eachFilter.field][es.visit].data[i] <= eachFilter.value) {
                                valid = false;
                            }
                            break;
                        }
                        case '<=': {
                            if (results[eachFilter.field][es.visit].data[i] > eachFilter.value) {
                                valid = false;
                            }
                            break;
                        }
                        case '>=': {
                            if (results[eachFilter.field][es.visit].data[i] < eachFilter.value) {
                                valid = false;
                            }
                            break;
                        }
                        default: {
                            valid = false;
                            break;
                        }
                    }
                }
                if (valid && dataByVisit[i] !== '99999') {
                    dataClip.data['Group-'.concat(index.toString())].push(parseFloat(dataByVisit[i]));
                }
            }
        });
        // construct data for visualization
        if ([enumValueType.INTEGER, enumValueType.DECIMAL].includes(fieldDef.dataType)) {
            const dataForGraph: any = Object.keys(dataClip.data).reduce((acc, curr) => {
                dataClip.data[curr].forEach(el => {
                    acc.push({
                        x: curr,
                        y: el
                    });
                });
                return acc;
            }, ([] as any));
            dataClip.dataForGraph = dataForGraph;
        } else if ([enumValueType.CATEGORICAL, enumValueType.BOOLEAN].includes(fieldDef.dataType)) {
            const dataForGraph: any = Object.keys(dataClip.data).reduce((acc, curr) => {
                if (fieldDef.possibleValues !== undefined) {
                    fieldDef.possibleValues.forEach(ek => {
                        acc.push({
                            x: curr,
                            y: dataClip.data[curr].filter(es => es.toString() === ek.code.toString()).length,
                            type: ek.description
                        });
                    });
                } else {
                    return acc;
                }
                return acc;
            }, ([] as any));
            dataClip.dataForGraph = dataForGraph;
        }
        // construct data for statistics
        dataClip.ttest = {
            score: [],
            pvalue: []
        };
        dataClip.ztest = {
            score: [],
            pvalue: []
        };
        dataClip.utest = {
            score: [],
            pvalue: []
        };
        for (const x of Object.keys(dataClip.data)) {
            for (const y of Object.keys(dataClip.data)) {
                const tstatistic = get_t_test(dataClip.data[x], dataClip.data[y], 4);
                const zstatistic = get_z_test(dataClip.data[x], dataClip.data[y], 4);
                dataClip.ttest.score.push({
                    xLabel: x,
                    yLabel: y,
                    score: tstatistic[0]
                });
                dataClip.ttest.pvalue.push({
                    xLabel: x,
                    yLabel: y,
                    pvalue: tstatistic[1]
                });
                dataClip.ztest.score.push({
                    xLabel: x,
                    yLabel: y,
                    score: zstatistic[0]
                });
                dataClip.ztest.pvalue.push({
                    xLabel: x,
                    yLabel: y,
                    pvalue: zstatistic[1]
                });
                dataClip.utest.score.push({
                    xLabel: x,
                    yLabel: y,
                    score: parseFloat(mannwhitneyu(dataClip.data[x], dataClip.data[y], 'less', undefined)['U'].toFixed(4))
                });
                dataClip.utest.pvalue.push({
                    xLabel: x,
                    yLabel: y,
                    pvalue: parseFloat(mannwhitneyu(dataClip.data[x], dataClip.data[y], 'less', undefined)['p'].toFixed(4))
                });
            }
        }
        data.push(dataClip);
    });
    return data;
}
