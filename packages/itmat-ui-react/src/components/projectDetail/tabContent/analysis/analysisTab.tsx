import { FunctionComponent, useEffect, useState } from 'react';
import { statisticsTypes, analysisTemplate, options, dataTypeMapping } from '../utils/defaultParameters';
import { get_t_test, get_z_test, mannwhitneyu, findDmField, generateCascader } from '../../../../utils/tools';
import { useQuery, useLazyQuery } from '@apollo/client/react/hooks';
import { GET_STUDY_FIELDS, GET_PROJECT, GET_DATA_RECORDS, GET_ONTOLOGY_TREE } from '@itmat-broker/itmat-models';
import { IFieldEntry, IProject, enumValueType, IOntologyTree, IOntologyRoute } from '@itmat-broker/itmat-types';
import LoadSpinner from '../../../reusable/loadSpinner';
import { SubsectionWithComment } from '../../../reusable/subsection/subsection';
import css from './tabContent.module.css';
import exportFromJSON from 'export-from-json';
import { Select, Form, Modal, Divider, Slider, Table, Button, Input, Tag, Popconfirm, message, Tooltip, Cascader, Popover, Space, Progress, Collapse, Typography } from 'antd';
import { Heatmap, Violin, Column } from '@ant-design/plots';
import { PlusOutlined, MinusCircleOutlined, CopyOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useParams } from 'react-router-dom';
import { useWindowSize } from '../utils/utils';
const { Option } = Select;
const { SHOW_CHILD } = Cascader;
const { Panel } = Collapse;
const { Title, Text } = Typography;

export const AnalysisTabContent: FunctionComponent<{ studyId: string }> = ({ studyId }) => {
    const { projectId } = useParams();

    const { loading: getStudyFieldsLoading, error: getStudyFieldsError, data: getStudyFieldsData } = useQuery(GET_STUDY_FIELDS, { variables: { studyId: studyId, projectId: projectId } });
    const { loading: getProjectLoading, error: getProjectError, data: getProjectData } = useQuery(GET_PROJECT, { variables: { projectId: projectId, admin: false } });
    const [getDataRecords, { loading: getDataRecordsLoading, data: getDataRecordsData }] = useLazyQuery(GET_DATA_RECORDS, {
        fetchPolicy: 'network-only'
    });
    const [currentStep, setCurrentStep] = useState(-1);
    const [filters, setFilters] = useState<any>({
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
    const [width, __unused__height__] = useWindowSize();
    if (getStudyFieldsLoading || getProjectLoading || getDataRecordsLoading || getOntologyTreeLoading) {
        return <LoadSpinner />;
    }
    if (!projectId || getStudyFieldsError || getProjectError || getOntologyTreeError) {
        return <div className={`${css.tab_page_wrapper} ${css.both_panel} ${css.upload_overlay}`}>
            An error occured, please contact your administrator
        </div>;
    }

    if (width < 1200) {
        return <span>The width of the resolution of your screen must be at least 1200px.</span>;
    }

    if (getStudyFieldsData.getStudyFields.length === 0) {
        return <span>No Fields Found.</span>;
    }

    if (getOntologyTreeData.getOntologyTree[0] === undefined) {
        return <span>Ontology Tree Missing!</span>;
    }

    const fieldPathOptions: any = [];
    getOntologyTreeData.getOntologyTree[0]?.routes.forEach(el => {
        generateCascader(el, fieldPathOptions, true);
    });

    const genderField: any = findDmField(getOntologyTreeData.getOntologyTree[0], getStudyFieldsData.getStudyFields, 'SEX');
    const raceField: any = findDmField(getOntologyTreeData.getOntologyTree[0], getStudyFieldsData.getStudyFields, 'RACE');
    const ageField: any = findDmField(getOntologyTreeData.getOntologyTree[0], getStudyFieldsData.getStudyFields, 'AGE');
    const siteField: any = findDmField(getOntologyTreeData.getOntologyTree[0], getStudyFieldsData.getStudyFields, 'SITE');
    const results = divideResults(filters, getDataRecordsData?.getDataRecords.data, getStudyFieldsData.getStudyFields,
        [genderField, raceField, ageField, siteField]);
    return (<div className={css.tab_page_wrapper}>
        <div className={css.scaffold_wrapper}></div>
        <FilterSelector guideTool={[currentStep, setCurrentStep]} filtersTool={[filters, setFilters]} fields={getStudyFieldsData.getStudyFields} project={getProjectData.getProject} query={getDataRecords}
            ontologyTree={getOntologyTreeData.getOntologyTree[0]} fieldPathOptions={fieldPathOptions} dmFields={[genderField, raceField, ageField, siteField]} />
        <br />
        {
            (results && results.length) > 0 ?
                <ResultsVisualization project={getProjectData.getProject} fields={getStudyFieldsData.getStudyFields} data={results} />
                :
                null
        }
    </div>);
};

const FilterSelector: FunctionComponent<{ guideTool: any, filtersTool: any, fields: IFieldEntry[], project: IProject, query: any, ontologyTree: IOntologyTree, fieldPathOptions: any, dmFields: any[] }> = ({ guideTool, filtersTool, fields, project, query, ontologyTree, fieldPathOptions, dmFields }) => {
    const [isModalOn, setIsModalOn] = useState(false);
    const [isTemplateModalOn, setIsTemplateModalOn] = useState(false);
    const [templateType, setTemplateType] = useState<string | undefined>('NA');
    const [currentGroupIndex, setCurrentGroupIndex] = useState(-1);
    const [form] = Form.useForm();
    useEffect(() => {
        form.setFieldsValue(formInitialValues(form, filtersTool[0], currentGroupIndex));
    });
    const [genderField, raceField] = dmFields;

    return (<div className={css.scaffold_wrapper}>
        <div>
            <SubsectionWithComment title='Introduction' comment={
                <Space>
                    <Button onClick={() => {
                        guideTool[1](0);
                        filtersTool[1]({
                            groups: [],
                            comparedFields: []
                        });
                    }}>Start to Guide</Button>
                    <Button onClick={() => {
                        guideTool[1](-1);
                        filtersTool[1]({
                            groups: [],
                            comparedFields: []
                        });
                    }}>Exit Guide</Button>
                </Space>
            }>
                <Modal
                    title={popoverContents[guideTool[0]]?.title || ''}
                    visible={guideTool[0] === 0}
                    onOk={() => guideTool[1](guideTool[0] + 1)}
                    onCancel={() => guideTool[1](-1)}
                    okText={'Continue'}
                    cancelText={'Exit'}
                >
                    {popoverContents[guideTool[0]]?.content || ''}
                </Modal>
                {
                    guideTool[0] === -1 ? null :
                        <div>
                            <div style={{ fontSize: '40px' }}><span>Progress</span></div>
                            <Progress
                                strokeColor={{
                                    from: '#108ee9',
                                    to: '#87d068'
                                }}
                                style={{ width: '80%' }}
                                percent={(guideTool[0] + 1) / popoverContents.length * 100}
                                type={'line'}
                                // steps={popoverContents.length}
                                format={() => { return null; }}
                            >
                            </Progress>
                        </div>
                }
                <Collapse ghost>
                    <Panel header='View full guidence.' key='full-guidence'>
                        <Title level={5}>1. Create several groups based on different criteria.</Title>
                        <Text>You can filter participants by their demographics, or specify a range of a field.</Text>
                        <Title level={5}>2. Select the fields to analyse.</Title>
                        <Text>The fields are organised by the ontology tree of the associated study. You can easily select a collection of them.</Text>
                        <Title level={5}>3. View the results.</Title>
                        <Text>Several basic statistics analysis are provided. The results can be exported in a json format.</Text>
                    </Panel>
                </Collapse>
            </SubsectionWithComment>
        </div><br />
        <div>
            <SubsectionWithComment
                title='Data Selection'
                comment={<div>
                    <Space>
                        <Popover
                            visible={guideTool[0] === popoverContents[1].step && !isModalOn}
                            title={popoverContents[1].title}
                            content={<div style={{ overflow: 'hidden' }}>
                                <span>{popoverContents[1].content}</span><br />
                                {/* <Button style={{ float: 'left' }} onClick={() => setCurrentStep(currentStep + 1)}>Continue</Button> */}
                                <Button style={{ float: 'right' }} onClick={() => guideTool[1](-1)}>Exit</Button>
                            </div>}
                        >
                            <Button className={css.button} onClick={() => {
                                if (guideTool[0] !== -1) {
                                    guideTool[1](guideTool[0] + 1);
                                }
                                setIsModalOn(true);
                                setCurrentGroupIndex(-1);
                            }} disabled={guideTool[0] !== -1 && guideTool[0] !== popoverContents[1].step}>Create group</Button>
                        </Popover>
                        <Button className={css.button}
                            onClick={() => {
                                if (currentGroupIndex === -1) {
                                    if (guideTool[0] === popoverContents[guideTool[0] - 1]?.step) {
                                        message.error('You havn\'t copy that.');
                                    }
                                    return;
                                } else {
                                    if (guideTool[0] === popoverContents[3]?.step) {
                                        guideTool[1](guideTool[0] + 1);
                                    }
                                    const newFilters = { ...filtersTool[0] };
                                    newFilters.groups = [...filtersTool[0].groups, filtersTool[0].groups[currentGroupIndex]];
                                    filtersTool[1](newFilters);
                                }
                            }}
                            disabled={guideTool[0] !== -1 && guideTool[0] !== popoverContents[3].step}
                            danger={guideTool[0] === popoverContents[3]?.step && currentGroupIndex !== -1}
                        >Paste group</Button>
                        <Button className={css.button} onClick={() => {
                            setIsTemplateModalOn(true);
                        }} disabled={guideTool[0] !== -1}>Select a template</Button>
                        <Button className={css.button} type='primary' onClick={() => {
                            query({
                                variables: {
                                    studyId: project.studyId,
                                    projectId: project.id,
                                    queryString: {
                                        ...combineFilters(fields, filtersTool[0], dmFields)
                                    }
                                }
                            });
                            if (guideTool[0] === popoverContents[5].step) {
                                guideTool[1](guideTool[0] + 1);
                            }
                        }} disabled={guideTool[0] !== -1 && guideTool[0] !== popoverContents[5].step} danger={guideTool[0] === popoverContents[5].step}>Analyse</Button>
                    </Space>
                </div>}>
                <Modal
                    title={'Template'}
                    visible={isTemplateModalOn}
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
                        getPopupContainer={trigger => trigger.parentElement}
                    >
                        {
                            Object.keys(analysisTemplate).map(el => <Option value={el} >{analysisTemplate[el].description}</Option>)
                        }
                    </Select>
                </Modal>
                <Modal
                    title={'Filters'}
                    visible={isModalOn}
                    width={1000}
                    style={{ top: 200 }}
                    onOk={() => {
                        if (form.getFieldsValue().visit === null) {
                            message.error('You must select a specific visit.');
                            return;
                        }
                        if (guideTool[0] === popoverContents[2].step || guideTool[0] === popoverContents[4].step) {
                            guideTool[1](guideTool[0] + 1);
                        }
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
                        setIsModalOn(false);
                    }}
                    onCancel={() => {
                        setIsModalOn(false);
                        guideTool[1](-1);
                    }}
                    okText={guideTool[0] === -1 ? 'Ok' : 'Continue'}
                    cancelText={guideTool[0] === -1 ? 'Cancel' : 'Exit'}
                >
                    <Form
                        layout='horizontal'
                        form={form}
                    >
                        {
                            guideTool[0] === popoverContents[2].step ?

                                <>
                                    <div style={{ overflow: 'hidden' }}>
                                        <span style={{ float: 'left' }}>{popoverContents[1].content}</span><br />
                                        <Button style={{ float: 'right' }} onClick={() => {
                                            form.setFieldsValue({
                                                visit: 2,
                                                race: [raceField.possibleValues[1].code],
                                                genderID: [genderField.possibleValues[0].code],
                                                siteID: [],
                                                age: [
                                                    0,
                                                    100
                                                ],
                                                filters: []
                                            });
                                        }}>Fill in</Button>
                                    </div>
                                    <br />
                                </>
                                : null
                        }
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
                                getPopupContainer={trigger => trigger.parentElement}
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
                                getPopupContainer={trigger => trigger.parentElement}
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
                                getPopupContainer={trigger => trigger.parentElement}
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
                                                    columns={variableFilterColumns(guideTool, fields, remove, fieldPathOptions)}
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
                    rowClassName={(__unused_record__, index) => {
                        return index === currentGroupIndex ? css.selected_color : css.white;
                    }}
                    pagination={false}
                    columns={filterTableColumns(guideTool, fields, [genderField, raceField], filtersTool, setIsModalOn, setCurrentGroupIndex)}
                    dataSource={[...(filtersTool[0].groups || [])]}
                    size='middle'
                ></Table>
                <Popover
                    visible={guideTool[0] === popoverContents[5].step}
                    title={popoverContents[5].title}
                    content={popoverContents[5].content}
                    placement={'bottom'}
                >
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
                        getPopupContainer={trigger => trigger.parentElement}
                        multiple
                        maxTagCount='responsive'
                        showCheckedStrategy={SHOW_CHILD}
                    />
                </Popover>
            </SubsectionWithComment>
        </div>
    </div >);
};

const ResultsVisualization: FunctionComponent<{ project: IProject, fields: IFieldEntry[], data: any }> = ({ project, fields, data }) => {
    const [statisticsType, setStatisticsType] = useState('ttest');
    const [signifianceLevel, setSignigicanceLevel] = useState<number | undefined>(undefined);
    if (data === undefined) {
        return null;
    }
    const maxShowLength = 15;
    const fieldColumns = [
        {
            title: 'Attribute',
            dataIndex: 'key',
            key: 'key',
            render: (__unused__value, record) => {
                return record.key;
            }
        },
        {
            title: 'Value',
            dataIndex: 'value',
            key: 'value',
            render: (__unused__value, record) => {
                return record.value;
            }
        }
    ];
    const columns = [
        {
            title: 'Field ID',
            dataIndex: 'field',
            key: 'field',
            render: (__unused__value, record) => {
                const thisField = fields.filter(el => el.fieldId === record.field)[0];
                const data: any = [];
                data.push({
                    key: 'Field Name',
                    value: <Tooltip title={thisField.fieldName}>
                        <span>{thisField?.fieldName ? thisField.fieldName.length > maxShowLength ? thisField.fieldName.substring(0, maxShowLength) + '...' :
                            thisField.fieldName : 'NA'}</span>
                    </Tooltip >
                }, {
                    key: 'Table Name',
                    value: thisField.tableName || 'NA'
                }, {
                    key: 'Data Type',
                    value: dataTypeMapping[thisField.dataType] || 'NA'
                }, {
                    key: 'Unit',
                    value: thisField.unit || 'NA'
                }, {
                    key: 'Comments',
                    value: thisField.comments || 'NA'
                });
                return <Tooltip
                    placement='topLeft'
                    arrowPointAtCenter
                    title={<Table
                        scroll={{ x: 'max-content' }}
                        pagination={false}
                        columns={fieldColumns}
                        dataSource={data}
                        size='middle'
                    >
                    </Table>}
                >
                    <Button>{record.field.toString()}</Button>
                </Tooltip>;
            }
        },
        {
            title: <div>
                <Popover
                    content={'This column shows the data distribution.'}
                    placement={'topLeft'}
                    trigger={'hover'}
                >Data Summary</Popover>
            </div>,
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
            title: <div>
                <Popover
                    content={'This column shows the score of a specific statistics.'}
                    placement={'topLeft'}
                    trigger={'hover'}
                >Statistics Score</Popover>
            </div>,
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
                <div style={{ display: 'inline-block', float: 'left' }}>
                    <Popover
                        content={'This column shows the p-value of a specific statistics.'}
                        placement={'bottomRight'}
                        trigger={'hover'}
                    >Statistics Pvalue</Popover>
                </div>
                <div style={{ display: 'inline-block', float: 'right' }}>
                    <Popover
                        content={'You can set a specific significance level.'}
                        placement={'leftTop'}
                        trigger={'hover'}
                    >
                        <Select
                            getPopupContainer={trigger => trigger.parentElement}
                            placeholder='Significance Level'
                            style={{ float: 'right' }}
                            value={signifianceLevel}
                            onChange={(value) => setSignigicanceLevel(value)}
                        >
                            <Option value={0.05} >0.05</Option>
                            <Option value={0.01} >0.01</Option>
                            <Option value={undefined} >NA</Option>
                        </Select>
                    </Popover>
                </div>
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
                                    backgroundColor: 'orange' // custom color
                                }
                            };
                        } else {
                            return {
                                type: 'square',
                                cfg: {
                                    backgroundColor: 'white' // custom color
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
        }
    ];
    return (<div>
        <SubsectionWithComment title='Results' comment={<div>
            <Space>
                <Select
                    getPopupContainer={trigger => trigger.parentElement}
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
                <Button style={{ float: 'right' }} onClick={() => {
                    const fileName = 'analyticalResults-v'.concat(project.dataVersion?.version.toString() || '').concat('.json');
                    const exportType = exportFromJSON.types.json;
                    exportFromJSON({ data, fileName, exportType });
                }}>Export</Button>
            </Space>
        </div>}>
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

function variableFilterColumns(guideTool: any, fields: IFieldEntry[], remove: any, fieldPathOptions: any) {
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
                        <Select
                            placeholder={'Select Operation'}
                            getPopupContainer={trigger => trigger.parentElement}
                        >
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
            render: (__unused__value, record) => {
                return (
                    <MinusCircleOutlined onClick={() => remove(record.name)} />
                );
            }
        }
    ];
}

function filterTableColumns(guideTool: any, fields: IFieldEntry[], dmFields: any[], filtersTool?: any, setIsModalOn?: any, setCurrentGroupIndex?: any) {
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
                            record.genderID.map(el => <Tag color={options.tagColors.genderID} >{genderField?.possibleValues?.filter(ed => ed.code === el.toString())[0].description}</Tag>)
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
                    <Popover
                        visible={guideTool[0] === popoverContents[3].step}
                        title={popoverContents[guideTool[0]]?.title || ''}
                        content={popoverContents[guideTool[0]]?.content || ''}
                        placement={'bottomRight'}
                    >
                        <CopyOutlined
                            style={{ color: guideTool[0] === popoverContents[3].step ? 'red' : 'blue' }}
                            key='copy'
                            onClick={() => {
                                setCurrentGroupIndex(index);
                            }} />
                    </Popover>

                </div>;
            }
        });
        columns.push({
            title: 'Edit',
            dataIndex: 'edit',
            key: 'edit',
            render: (__unused__value, __unused__record, index) => {
                return <div>
                    <Popover
                        visible={guideTool[0] === 4 && index === 1}
                        title={popoverContents[4].title}
                        content={popoverContents[4].content}
                        placement={'bottomRight'}
                    >
                        <EditOutlined
                            style={{ color: guideTool[0] === popoverContents[4].step ? 'red' : 'blue' }}
                            key='edit'
                            onClick={() => {
                                setCurrentGroupIndex(index);
                                setIsModalOn(true);
                            }} />
                    </Popover>
                </div >;
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
        siteID: dmFields[3]
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


const popoverContents = [
    {
        step: 0,
        title: 'Let\'s start!',
        content: 'We will compare results from BPI Questionnaire by gender/sex of a specific visit.',
        requireContinue: true
    },
    {
        step: 1,
        title: 'Creating the first group.',
        content: 'We will create a group of male participants only.',
        requireContinue: true
    },
    {
        step: 2,
        title: 'Set up the filters.',
        content: 'You need to filter participants by the following criteria. You can use our template by clicking Fill in.',
        requireContinue: true
    },
    {
        step: 3,
        title: 'Create the second group.',
        content: 'Copy the first group and paste it.',
        requireContinue: true
    },
    {
        step: 4,
        title: 'Change the filters.',
        content: 'Change the sex to male.',
        requireContinue: true
    },
    {
        step: 5,
        title: 'Select the fields to compare.',
        content: 'We will select all fields of the BMI questionnires. Then click Analyse.',
        requireContinue: true
    },
    {
        step: 6,
        title: 'View the results.',
        content: 'You can view the results from now.'
    }
];
