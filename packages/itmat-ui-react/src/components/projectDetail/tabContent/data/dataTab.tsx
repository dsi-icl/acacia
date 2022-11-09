import { FunctionComponent, useState } from 'react';
import { filterFields, generateCascader, findDmField } from '../../../../utils/tools';
import { dataTypeMapping } from '../utils/defaultParameters';
import { useQuery, useLazyQuery } from '@apollo/client/react/hooks';
import { GET_STUDY_FIELDS, GET_PROJECT, GET_DATA_RECORDS, GET_ONTOLOGY_TREE, GET_STANDARDIZATION } from '@itmat-broker/itmat-models';
import { IFieldEntry, IProject, enumValueType, IOntologyTree, IOntologyRoute } from '@itmat-broker/itmat-types';
import { Query } from '@apollo/client/react/components';
import LoadSpinner from '../../../reusable/loadSpinner';
import { Subsection, SubsectionWithComment } from '../../../reusable/subsection/subsection';
import css from './tabContent.module.css';
import { CSVLink } from 'react-csv';
import { Select, Row, Col, Button, Table, Empty, Cascader, Tooltip, Typography, Space } from 'antd';
import { Pie, BidirectionalBar, Heatmap, Violin, Column, Box } from '@ant-design/plots';
import { UserOutlined, DownloadOutlined, QuestionCircleOutlined, TagOutlined, HistoryOutlined, FieldTimeOutlined, EyeOutlined, HddOutlined } from '@ant-design/icons';
import { useParams } from 'react-router-dom';
import React from 'react';
import { useWindowSize } from '../utils/utils';
const { Option } = Select;
const { Text } = Typography;

export const DataTabContent: FunctionComponent<{ studyId: string }> = ({ studyId }) => {
    const { projectId } = useParams();
    const { loading: getStudyFieldsLoading, error: getStudyFieldsError, data: getStudyFieldsData } = useQuery(GET_STUDY_FIELDS, { variables: { studyId: studyId, projectId: projectId } });
    const { loading: getProjectLoading, error: getProjectError, data: getProjectData } = useQuery(GET_PROJECT, { variables: { projectId: projectId, admin: false } });
    const { loading: getOntologyTreeLoading, error: getOntologyTreeError, data: getOntologyTreeData } = useQuery(GET_ONTOLOGY_TREE, {
        variables: {
            studyId: studyId,
            projectId: projectId,
            treeId: null
        }
    });
    const [width, __unused__height__] = useWindowSize();
    if (getStudyFieldsLoading || getProjectLoading || getOntologyTreeLoading) {
        return <LoadSpinner />;
    }
    if (!projectId || getStudyFieldsError || getProjectError || getOntologyTreeError) {
        return <div className={`${css.tab_page_wrapper} ${css.both_panel} ${css.upload_overlay}`}>
            An error occured, please contact your administrator
        </div >;
    }
    if (getStudyFieldsData.getStudyFields.length === 0) {
        return <span>No Fields Found.</span>;
    }

    if (getOntologyTreeData.getOntologyTree[0] === undefined) {
        return <span>Ontology Tree Missing!</span>;
    }
    if (width < 900) {
        return <span>The width of the resolution of your screen must be at least 900px.</span>;
    }
    return <div className={css.tab_page_wrapper}>
        <div className={css.scaffold_wrapper}>
            <div className={css.metadata}>
                <MetaDataBlock project={getProjectData.getProject} numOfFields={getStudyFieldsData.getStudyFields.length} numOfOntologyRoutes={getOntologyTreeData.getOntologyTree[0].routes.length} />
            </div>
            <div className={css.demographics}>
                <DemographicsBlock ontologyTree={getOntologyTreeData.getOntologyTree[0]} studyId={studyId} projectId={projectId} fields={filterFields(getStudyFieldsData.getStudyFields, getOntologyTreeData.getOntologyTree[0])} />
            </div>
            <div className={css.data_distribution}>
                <DataDistributionBlock ontologyTree={getOntologyTreeData.getOntologyTree[0]} fields={getStudyFieldsData.getStudyFields} project={getProjectData.getProject} />
            </div>
            <div className={css.data_completeness}>
                <DataCompletenessBlock studyId={studyId} projectId={getProjectData.getProject.id} ontologyTree={getOntologyTreeData.getOntologyTree[0]} fields={filterFields(getStudyFieldsData.getStudyFields, getOntologyTreeData.getOntologyTree[0])} />
            </div>
            <div className={css.data_download}>
                <DataDownloadBlock project={getProjectData.getProject} />
            </div>
        </div>
    </div>;
};

export const MetaDataBlock: FunctionComponent<{ project: IProject, numOfFields: number, numOfOntologyRoutes: number }> = ({ project, numOfFields, numOfOntologyRoutes }) => {
    const [width, __unused__height__] = useWindowSize();
    return project ? <SubsectionWithComment title={<Tooltip title={'The metadata of this project.'}>
        <Text className={css.title}>Meta Data</Text> <QuestionCircleOutlined />
    </Tooltip>} comment={<Space direction={'horizontal'} size={20}>
        <div><HistoryOutlined /> <span>Data Version - {project?.dataVersion?.version}</span></div>
        <div><TagOutlined /> <span>Version Tag - {project?.dataVersion?.tag}</span></div>
    </Space>}>
        {
            width > 1500 ?
                <div>
                    <Row gutter={16}>
                        <Col span={5}>
                            <div className={css.grid_col_center} ><UserOutlined style={{ fontSize: '700%' }} /></div>
                        </Col>
                        <Col span={5}>
                            <div className={css.grid_col_center}><EyeOutlined style={{ fontSize: '700%' }} /></div>
                        </Col>
                        <Col span={5}>
                            <div className={css.grid_col_center}><HddOutlined style={{ fontSize: '700%' }} /></div>
                        </Col>
                        <Col span={9}>
                            <div className={css.grid_col_center}><FieldTimeOutlined style={{ fontSize: '700%' }} /></div>
                        </Col>
                    </Row><br />
                    <Row gutter={16}>
                        <Col span={5}>
                            <div className={css.grid_col_center}><span>Participants</span></div>
                        </Col>
                        <Col span={5}>
                            <div className={css.grid_col_center}><span>Visits</span></div>
                        </Col>
                        <Col span={5}>
                            <div className={css.grid_col_center}><span>Fields</span></div>
                        </Col>
                        <Col span={9}>
                            <div className={css.grid_col_center}><span>Updated At</span></div>
                        </Col>
                    </Row><br />
                    <Row gutter={16}>
                        <Col span={5}>
                            <div className={css.grid_col_center}><Text style={{ fontSize: '32px' }} strong underline>{project?.summary?.subjects?.length}</Text></div>
                        </Col>
                        <Col span={5}>
                            <div className={css.grid_col_center}><Text style={{ fontSize: '32px' }} strong underline>{project?.summary?.visits?.length}</Text></div>
                        </Col>
                        <Col span={5}>
                            <div className={css.grid_col_center}>
                                <Text style={{ fontSize: '32px' }} strong underline>{numOfOntologyRoutes} / {numOfFields}</Text>
                                <Tooltip title={`${numOfOntologyRoutes} of ${numOfFields} fields are in the ontology tree.`}>
                                    <QuestionCircleOutlined />
                                </Tooltip>
                            </div>
                        </Col>
                        <Col span={9}>
                            <div className={css.grid_col_center}><Text style={{ fontSize: '32px' }} strong underline>{project.dataVersion?.updateDate === undefined ? 'NA' : (new Date(parseFloat(project.dataVersion?.updateDate))).toUTCString()}</Text></div>
                        </Col>
                    </Row><br />
                </div> :
                <div>
                    <Row gutter={16}>
                        <Col span={9}>
                            <div className={css.grid_col_center} ><UserOutlined style={{ fontSize: '700%' }} /></div>
                        </Col>
                        <Col span={15}>
                            <div className={css.grid_col_center}><EyeOutlined style={{ fontSize: '700%' }} /></div>
                        </Col>
                    </Row><br />
                    <Row gutter={16}>
                        <Col span={9}>
                            <div className={css.grid_col_center}><span>Participants</span></div>
                        </Col>
                        <Col span={15}>
                            <div className={css.grid_col_center}><span>Visits</span></div>
                        </Col>
                    </Row><br />
                    <Row gutter={16}>
                        <Col span={9}>
                            <div className={css.grid_col_center}><Text style={{ fontSize: '32px' }} strong underline>{project?.summary?.subjects?.length}</Text></div>
                        </Col>
                        <Col span={15}>
                            <div className={css.grid_col_center}><Text style={{ fontSize: '32px' }} strong underline>{project?.summary?.visits?.length}</Text></div>
                        </Col>
                    </Row><br />
                    <Row gutter={16}>
                        <Col span={9}>
                            <div className={css.grid_col_center}><HddOutlined style={{ fontSize: '700%' }} /></div>
                        </Col>
                        <Col span={15}>
                            <div className={css.grid_col_center}><FieldTimeOutlined style={{ fontSize: '700%' }} /></div>
                        </Col>
                    </Row>
                    <Row gutter={16}>
                        <Col span={9}>
                            <div className={css.grid_col_center}><span>Fields</span></div>
                        </Col>
                        <Col span={15}>
                            <div className={css.grid_col_center}><span>Updated At</span></div>
                        </Col>
                    </Row>
                    <Row gutter={16}>
                        <Col span={9}>
                            <div className={css.grid_col_center}>
                                <Text style={{ fontSize: '32px' }} strong underline>{numOfOntologyRoutes} / {numOfFields}</Text>
                                <Tooltip title={`${numOfOntologyRoutes} of ${numOfFields} fields are in the ontology tree.`}>
                                    <QuestionCircleOutlined />
                                </Tooltip>
                            </div>
                        </Col>
                        <Col span={15}>
                            <div className={css.grid_col_center}><Text style={{ fontSize: '32px' }} strong underline>{project.dataVersion?.updateDate === undefined ? 'NA' : (new Date(parseFloat(project.dataVersion?.updateDate))).toDateString()}</Text></div>
                        </Col>
                    </Row>
                </div>
        }
    </SubsectionWithComment > : null;
};

export const DemographicsBlock: FunctionComponent<{ ontologyTree: IOntologyTree, studyId: string, projectId: string, fields: IFieldEntry[] }> = ({ ontologyTree, studyId, projectId, fields }) => {
    const [width, __unused__height__] = useWindowSize();
    // process the data
    const genderField: any = findDmField(ontologyTree, fields, 'SEX');
    const raceField: any = findDmField(ontologyTree, fields, 'RACE');
    const ageField: any = findDmField(ontologyTree, fields, 'AGE');
    const siteField: any = findDmField(ontologyTree, fields, 'SITE');

    const { loading: getDataRecordsLoading, error: getDataRecordsError, data: getDataRecordsData } = useQuery(GET_DATA_RECORDS, {
        variables: {
            studyId: studyId,
            projectId: projectId,
            queryString: {
                format: 'grouped',
                data_requested: [genderField.fieldId, raceField.fieldId, ageField.fieldId, siteField.fieldId],
                new_fields: [],
                cohort: [[]],
                subjects_requested: null,
                visits_requested: null
            }
        }
    });
    if (getDataRecordsLoading) {
        return <LoadSpinner />;
    }
    if (getDataRecordsError) {
        return <div className={`${css.tab_page_wrapper} ${css.both_panel} ${css.upload_overlay}`}>
            An error occured, please contact your administrator
        </div>;
    }
    console.log(getDataRecordsData);
    // process the data
    const obj: any = {};
    const data = getDataRecordsData.getDataRecords.data;
    if (genderField === null) {
        obj.SEX = [];
        obj.AGE = [];
    } else {
        obj.SEX = (data[genderField.fieldId][genderField.visitRange[0]]?.data || []).reduce((acc, curr) => {
            const thisGender = genderField?.possibleValues?.filter(el => el.code === curr)[0].description || '';
            if (acc.filter(es => es.type === thisGender).length === 0) {
                acc.push({ type: thisGender, value: 0 });
            }
            acc[acc.findIndex(es => es.type === thisGender)].value += 1;
            return acc;
        }, []);
        obj.SEX.push({
            type: 'Missing',
            value: (data[genderField.fieldId][genderField.visitRange[0]]?.totalNumOfRecords || 0) - (data[genderField.fieldId][genderField.visitRange[0]].validNumOfRecords || 0)
        });
        if (ageField === null) {
            obj.AGE = [];
        } else {
            obj.AGE = (data[ageField.fieldId][ageField.visitRange[0]]?.data || []).reduce((acc, curr, index) => {
                if (acc.filter(es => es.age === curr).length === 0) {
                    acc.push({ age: curr, Male: 0, Female: 0 });
                }
                if (data[genderField.fieldId][genderField.visitRange[0]].data[index] === '1') {
                    acc[acc.findIndex(el => el.age === curr)].Female += 1;
                } else {
                    acc[acc.findIndex(el => el.age === curr)].Male += 1;
                }
                return acc;
            }, []);
        }
    }
    if (raceField === null) {
        obj.RACE = [];
    } else {
        if (data[raceField.fieldId] === undefined) {
            obj.RACE = [];
        } else {
            obj.RACE = (data[raceField.fieldId][raceField.visitRange[0]]?.data || []).reduce((acc, curr) => {
                const thisRace = raceField?.possibleValues?.filter(el => el.code === curr)[0].description || '';
                if (acc.filter(es => es.type === thisRace).length === 0) {
                    acc.push({ type: thisRace, value: 0 });
                }
                acc[acc.findIndex(es => es.type === thisRace)].value += 1;
                return acc;
            }, []);
            obj.RACE.push({
                type: 'Missing',
                value: (data[raceField.fieldId][raceField.visitRange[0]]?.totalNumOfRecords || 0) - (data[raceField.fieldId][raceField.visitRange[0]]?.validNumOfRecords || 0)
            });
        }
    }
    if (siteField === null) {
        obj.SITE = [];
    } else {
        obj.SITE = (data[siteField.fieldId][siteField.visitRange[0]]?.data || []).reduce((acc, curr) => {
            if (acc.filter(es => es.type === curr.toString()).length === 0) {
                acc.push({ type: curr.toString(), value: 0 });
            }
            acc[acc.findIndex(es => es.type === curr.toString())].value += 1;
            return acc;
        }, []);
        obj.SITE.push({
            type: 'Missing',
            value: (data[siteField.fieldId][siteField.visitRange[0]]?.totalNumOfRecords || 0) - (data[siteField.fieldId][siteField.visitRange[0]]?.validNumOfRecords || 0)
        });
    }

    return <Subsection title={<Tooltip title={'The statistics of several demographics fields.'}>
        <Text className={css.title}>Demographics</Text> <QuestionCircleOutlined />
    </Tooltip>}>
        <>
            {
                genderField === null ? null :
                    <div className={css.demographics_graph}>
                        <Pie
                            appendPadding={10}
                            data={obj.SEX}
                            angleField={'value'}
                            colorField={'type'}
                            radius={0.75}
                            legend={{
                                itemWidth: 100,
                                layout: width > 1500 ? 'vertical' : 'horizontal',
                                offsetX: 0,
                                position: width > 1500 ? 'right' : 'bottom'
                            }}
                            label={false}
                            interactions={[
                                {
                                    type: 'element-selected'
                                },
                                {
                                    type: 'element-active'
                                }
                            ]}
                        />
                        <div className={css.grid_col_center}><Text style={{ fontSize: '32px', marginRight: '90px' }} strong>Sex</Text></div>
                    </div>
            }
            {
                raceField === null ? null :
                    <div className={css.demographics_graph}>
                        <Pie
                            appendPadding={10}
                            data={obj.RACE}
                            angleField={'value'}
                            colorField={'type'}
                            radius={0.75}
                            legend={{
                                itemWidth: 100,
                                layout: width > 1500 ? 'vertical' : 'horizontal',
                                offsetX: 0,
                                position: width > 1500 ? 'right' : 'bottom'
                            }}
                            label={false}
                            interactions={[
                                {
                                    type: 'element-selected'
                                },
                                {
                                    type: 'element-active'
                                }
                            ]}
                        />
                        <div className={css.grid_col_center}><Text style={{ fontSize: '32px', marginRight: '90px' }} strong>Race</Text></div>
                    </div>
            }
            {
                siteField === null ? null :
                    <div className={css.demographics_graph}>
                        <Pie
                            appendPadding={10}
                            data={obj.SITE}
                            angleField={'value'}
                            colorField={'type'}
                            radius={0.75}
                            legend={{
                                itemWidth: 100,
                                layout: width > 1500 ? 'vertical' : 'horizontal',
                                offsetX: 0,
                                position: width > 1500 ? 'right' : 'bottom'
                            }}
                            label={false}
                            interactions={[
                                {
                                    type: 'element-selected'
                                },
                                {
                                    type: 'element-active'
                                }
                            ]}
                        />
                        <div className={css.grid_col_center}><Text style={{ fontSize: '32px', marginRight: '90px' }} strong>Site</Text></div>
                    </div>
            }
            {
                ageField === null ? null :
                    <div className={css.demographics_graph}>
                        <BidirectionalBar
                            data={obj.AGE}
                            xField={'age'}
                            xAxis={{
                                position: 'right'
                            }}
                            interactions={[
                                { type: 'active-region' }
                            ]}
                            yField={['Male', 'Female']}
                        />
                        <div className={css.grid_col_center}><Text style={{ fontSize: '32px' }} strong>Age</Text></div>
                    </div>
            }
        </>
    </Subsection >;
};

export const DataDistributionBlock: FunctionComponent<{ ontologyTree: IOntologyTree, fields: IFieldEntry[], project: IProject }> = ({ ontologyTree, fields, project }) => {
    const [selectedPath, setSelectedPath] = useState<any[]>([]);
    const [selectedGraphType, setSelectedGraphType] = useState<string | undefined>(undefined);
    const routes: IOntologyRoute[] = ontologyTree.routes?.filter(es => {
        return JSON.stringify([...es.path, es.name]) === JSON.stringify(selectedPath);
    }) || [];
    const field: IFieldEntry | undefined = fields.filter(el => {
        return el.fieldId.toString() === routes[0]?.field[0]?.replace('$', '');
    })[0];
    //construct the cascader
    const fieldPathOptions: any = [];
    ontologyTree.routes?.forEach(el => {
        generateCascader(el, fieldPathOptions, true);
    });
    // ellipsis
    const maxShowLength = 20;
    const fieldNameEllipsis: string = field?.fieldName ? field.fieldName.length > maxShowLength ? field.fieldName.substring(0, maxShowLength) + '...' :
        field.fieldName : 'NA';
    const fieldCommentsEllipsis: string = field?.comments ? field.comments.length > maxShowLength ? field.comments.substring(0, maxShowLength) + '...' :
        field.comments : 'NA';

    const axisConfig = {
        xAxis: {
            title: {
                text: 'Visit ID',
                style: {
                    fill: '#6E759F',
                    fontSize: 14
                }
            }
        },
        yAxisNum: {
            title: {
                text: 'Count',
                style: {
                    fill: '#6E759F',
                    fontSize: 14
                },
                position: 'start'
            }
        },
        yAxisPer: {
            title: {
                text: 'Percentage',
                style: {
                    fill: '#6E759F',
                    fontSize: 14
                },
                position: 'start'
            }
        }
    };

    return (<SubsectionWithComment title={<Tooltip title={'View the details of a selected field.'}>
        <Text className={css.title}>Data Distribution</Text> <QuestionCircleOutlined />
    </Tooltip>} comment={<>
        <Cascader
            getPopupContainer={trigger => trigger.parentNode}
            options={fieldPathOptions}
            onChange={(value) => {
                setSelectedPath(value);
            }}
            placeholder={'Select Field'}
        />
        <Select
            value={selectedGraphType}
            getPopupContainer={trigger => trigger.parentNode}
            placeholder='Select Graph Type'
            onChange={(value) => {
                setSelectedGraphType(value);
            }}
        >
            {
                [enumValueType.INTEGER, enumValueType.DECIMAL].includes(fields.filter(el => el.fieldId === field?.fieldId)[0]?.dataType) ?
                    <>
                        <Option value='violin'>Violin</Option>
                        <Option value='box'>Box</Option>
                    </> : <>
                        <Option value='stackedColumn'>Stacked Column</Option>
                        <Option value='groupedColumn'>Grouped Column</Option>
                    </>
            }
        </Select>
    </>} float={'right'}
    >
        {
            field === undefined ? <div style={{ height: '200px' }} ><Empty /></div> :
                <div>
                    <Row gutter={16}>
                        <Col xl={3} md={4}>
                            <div className={css.grid_col_center} ><span>Field ID</span></div>
                        </Col>
                        <Col xl={3} md={4}>
                            <div className={css.grid_col_center} ><span>Field Name</span></div>
                        </Col>
                        <Col xl={3} md={4}>
                            <div className={css.grid_col_center} ><span>Data Type</span></div>
                        </Col>
                        <Col xl={3} md={0}>
                            <div className={css.grid_col_center} ><span>Unit</span></div>
                        </Col>
                        <Col xl={3} md={0}>
                            <div className={css.grid_col_center} ><span>Comments</span></div>
                        </Col>
                        <Col xl={9} md={12}>
                            <div className={css.grid_col_center} >
                                <span>Ontology Chain</span>
                                <Tooltip title={'The route of the field in the ontology tree.'}>
                                    <QuestionCircleOutlined />
                                </Tooltip>
                            </div>
                        </Col>
                    </Row><br />
                    <Row gutter={16}>
                        <Col xl={3} md={4}>
                            <div className={css.grid_col_center_large} ><Text strong underline>{field?.fieldId || 'NA'}</Text></div>
                        </Col>
                        <Col xl={3} md={4}>
                            <div className={css.grid_col_center_large} ><Text strong underline>{<Tooltip title={field.fieldName}>
                                <span>{fieldNameEllipsis || 'NA'}</span>
                            </Tooltip >}</Text></div>
                        </Col>
                        <Col xl={3} md={4}>
                            <div className={css.grid_col_center_large} ><Text strong underline>{dataTypeMapping[field?.fieldId] || 'NA'}</Text></div>
                        </Col>
                        <Col xl={3} md={0}>
                            <div className={css.grid_col_center_large} ><Text strong underline>{field?.unit || 'NA'}</Text></div>
                        </Col>
                        <Col xl={3} md={0}>
                            <div className={css.grid_col_center_large} ><Text strong underline>{<Tooltip title={field.comments}>
                                <span>{fieldCommentsEllipsis || 'NA'}</span>
                            </Tooltip >}</Text></div>
                        </Col>
                        <Col xl={9} md={12}>
                            <div className={css.grid_col_center_large} ><Text strong underline>{(routes[0].path.slice(0, routes[0].path.length) || '').concat(fieldNameEllipsis).join(' => ')}</Text></div>
                        </Col><br />
                    </Row><br />
                    <Query<any, any> query={GET_DATA_RECORDS} variables={{
                        studyId: project.studyId,
                        projectId: project.id,
                        queryString: {
                            format: 'grouped',
                            data_requested: [ontologyTree.routes?.filter(el => el.name === selectedPath[selectedPath.length - 1])[0]?.field[0]?.replace('$', '') || ''],
                            cohort: [[]],
                            subjects_requested: null,
                            visits_requested: null
                        }
                    }}>
                        {({ data, loading, error }) => {
                            if (loading) { return <LoadSpinner />; }
                            if (error) { return <p>{JSON.stringify(error)}</p>; }
                            if (!data) { return <p>Not executed.</p>; }
                            const fieldIdFromData: string = Object.keys(data.getDataRecords.data)[0];
                            // return empty if the field is empty, this means that no such data is in database
                            if (fieldIdFromData === undefined) {
                                return <Empty />;
                            }
                            if ([enumValueType.INTEGER, enumValueType.DECIMAL].includes(fields.filter(el => el.fieldId === fieldIdFromData)[0].dataType)) {
                                data = Object.keys(data.getDataRecords.data[fieldIdFromData]).reduce((acc, curr) => {
                                    data.getDataRecords.data[fieldIdFromData][curr].data.forEach(el => {
                                        if (el === '99999') {
                                            return;
                                        }
                                        acc.push({ x: curr, y: el });
                                    });
                                    return acc;
                                }, ([] as any));
                            } else if ([enumValueType.CATEGORICAL, enumValueType.BOOLEAN].includes(fields.filter(el => el.fieldId === fieldIdFromData)[0].dataType)) {
                                data = Object.keys(data.getDataRecords.data[fieldIdFromData]).reduce((acc, curr) => {
                                    let count = 0;
                                    data.getDataRecords.data[fieldIdFromData][curr].data.forEach(el => {
                                        if (acc.filter(es => (es.visit === curr && es.value === el)).length === 0) {
                                            if (el === '99999') {
                                                return;
                                            }
                                            acc.push({ visit: curr, value: el, count: 0 });
                                        }
                                        count += 1;
                                        acc[acc.findIndex(es => (es.visit === curr && es.value === el))].count += 1;
                                    });
                                    // if no mising (either no missing or missing is considered as an option)
                                    if (project.summary.subjects.length - count !== 0) {
                                        acc.push({ visit: curr, value: 'No Record', count: project.summary.subjects.length - count });
                                    }
                                    return acc;
                                }, ([] as any)).sort((a, b) => { return parseFloat(a.value) - parseFloat(b.value); });
                            } else {
                                return null;
                            }
                            const boxData = data.reduce((acc, curr) => {
                                if (acc.filter(el => el.x === curr.x)[0] === undefined) {
                                    acc.push({ x: curr.x, y: [] });
                                }
                                acc.filter(el => el.x === curr.x)[0].y.push(curr.y);
                                return acc;
                            }, []).map(el => {
                                const sortedY = [...el.y].sort();
                                return {
                                    x: el.x,
                                    low: sortedY[0],
                                    q1: sortedY[Math.floor(sortedY.length / 4)],
                                    median: sortedY[Math.floor(sortedY.length / 2)],
                                    q3: sortedY[Math.floor(sortedY.length * 3 / 4)],
                                    high: sortedY[sortedY.length - 1]
                                };
                            });
                            if ([enumValueType.INTEGER, enumValueType.DECIMAL].includes(fields.filter(el => el.fieldId === fieldIdFromData)[0].dataType))
                                return (<>
                                    {
                                        selectedGraphType === 'violin' ? <Violin
                                            data={data}
                                            xField={'x'}
                                            yField={'y'}
                                            xAxis={axisConfig.xAxis}
                                            yAxis={axisConfig.yAxisNum}
                                        /> : selectedGraphType === 'box' ? <Box
                                            data={boxData}
                                            xField={'x'}
                                            yField={['low', 'q1', 'median', 'q3', 'high']}
                                            xAxis={axisConfig.xAxis}
                                            yAxis={axisConfig.yAxisNum}
                                            boxStyle={{
                                                stroke: '#545454',
                                                fill: '#1890FF',
                                                fillOpacity: 0.3
                                            }}
                                        /> : <Empty />
                                    }
                                </>);
                            else
                                return (<>
                                    {
                                        selectedGraphType === 'stackedColumn' || selectedGraphType === 'groupedColumn' ?
                                            <Column
                                                data={data}
                                                xField={'visit'}
                                                yField={'count'}
                                                xAxis={axisConfig.xAxis}
                                                yAxis={axisConfig.yAxisNum}
                                                seriesField={'value'}
                                                isPercent={false}
                                                isStack={selectedGraphType === 'stackedColumn'}
                                                isGroup={selectedGraphType === 'groupedColumn'}
                                                interactions={[
                                                    { type: 'element-highlight-by-color' },
                                                    { type: 'element-link' }
                                                ]}
                                            /> : <Empty />
                                    }
                                </>);
                        }}
                    </Query>
                </div>
        }
    </SubsectionWithComment >);
};

export const DataCompletenessBlock: FunctionComponent<{ studyId: string, projectId: string, ontologyTree: IOntologyTree, fields: IFieldEntry[] }> = ({ studyId, projectId, ontologyTree, fields }) => {
    const [selectedPath, setSelectedPath] = useState<any[]>([]);
    const requestedFields = ontologyTree.routes?.filter(el => {
        if (JSON.stringify(el.path) === JSON.stringify(selectedPath)) {
            return true;
        } else {
            return false;
        }
    }).map(el => el.field[0].replace('$', '')) || [];
    const { loading: getDataRecordsLoading, error: getDataRecordsError, data: getDataRecordsData } = useQuery(GET_DATA_RECORDS, {
        variables: {
            studyId: studyId,
            projectId: projectId,
            queryString: {
                format: 'summary',
                data_requested: requestedFields,
                cohort: [[]],
                subjects_requested: null,
                visits_requested: null
            }
        },
        fetchPolicy: 'network-only'
    });
    if (getDataRecordsLoading) {
        return <LoadSpinner />;
    }
    if (getDataRecordsError) {
        return <div className={`${css.tab_page_wrapper} ${css.both_panel} ${css.upload_overlay}`}>
            An error occured, please contact your administrator
        </div >;
    }
    // process the data
    const data = getDataRecordsData.getDataRecords.data;
    const obj: any[] = [];
    for (const fieldId of Object.keys(data)) {
        for (const visitId of Object.keys(data[fieldId])) {
            obj.push({
                visit: visitId,
                field: fieldId,
                percentage: parseInt(((data[fieldId][visitId].validNumOfRecords / data[fieldId][visitId].totalNumOfRecords) * 100).toFixed(0))
            });
        }
    }
    const axisConfig = {
        xAxis: {
            title: {
                text: 'Visit ID',
                style: {
                    fill: '#6E759F',
                    fontSize: 14
                }
            }
        },
        yAxis: {
            title: {
                text: 'Field ID',
                style: {
                    fill: '#6E759F',
                    fontSize: 14
                },
                position: 'start'
            }
        }
    };
    const tooltipConfig: any = {
        showTitle: false,
        fields: ['visit', 'field', 'percentage'],
        formatter: (datum: any) => {
            const field: IFieldEntry | undefined = fields.filter(el => el.fieldId === datum.field)[0];
            let name;
            if (field) {
                name = field.fieldId.concat('-').concat(field.fieldName);
            } else {
                name = 'NA';
            }
            return {
                name: name,
                value: datum.percentage + '%'
            };
        }
    };
    //construct the cascader
    const fieldPathOptions: any = [];
    ontologyTree.routes?.forEach(el => {
        generateCascader(el, fieldPathOptions, false);
    });
    return (
        <SubsectionWithComment title={<Tooltip title={'The percentage of valid data. The data completeness of a field is calculated by (number of valid data pointes / number of expected data pointes).'}>
            <Text className={css.title}>Data Completeness</Text> <QuestionCircleOutlined />
        </Tooltip >} comment={
            <Cascader
                getPopupContainer={trigger => trigger.parentNode}
                options={fieldPathOptions}
                onChange={(value) => setSelectedPath(value)}
                placeholder={'Please select'}
                value={selectedPath}
            />
        } float={'center'}
        >
            {
                selectedPath.length === 0 ? <Empty /> :
                    <Heatmap
                        style={{ overflow: 'auto' }}
                        data={obj}
                        height={Object.keys(data).length * 30 + 50}
                        width={500}
                        xField={'visit'}
                        yField={'field'}
                        renderer={'svg'}
                        colorField={'percentage'}
                        label={{
                            formatter: (datum: any) => {
                                return datum.percentage + '%';
                            }
                        }}
                        tooltip={tooltipConfig}
                        xAxis={axisConfig.xAxis}
                        yAxis={axisConfig.yAxis}
                    />
            }
        </SubsectionWithComment >
    );
};

export const DataDownloadBlock: FunctionComponent<{ project: IProject }> = ({ project }) => {
    const { loading: getStandardizationLoading, error: getStandardizationError, data: getStandardizationData } = useQuery(GET_STANDARDIZATION, { variables: { studyId: project.studyId, projectId: project.id } });
    const [getDataRecordsLazy, { loading: getDataRecordsLoading, data: getDataRecordsData }] = useLazyQuery(GET_DATA_RECORDS, {});
    const [shouldUpdateData, setShouldUpdateData] = useState(true);
    const [selectedDataFormat, setSelectedDataFormat] = useState<string | undefined>(undefined);
    const [selectedOutputType, setSelectedOutputType] = useState('JSON');
    if (getDataRecordsLoading || getStandardizationLoading) {
        return <LoadSpinner />;
    }
    if (getStandardizationError) {
        return <p>
            An error occured, please contact your administrator
        </p >;
    }
    const availableFormats: string[] = Array.from(new Set(getStandardizationData.getStandardization.map(el => el.type))) || [];
    const dataArray: any[] = [];
    if (getDataRecordsData?.getDataRecords?.data !== undefined) {
        Object.keys(getDataRecordsData.getDataRecords.data).forEach(domain => {
            dataArray.push({
                path: domain,
                data: getDataRecordsData.getDataRecords.data[domain]
            });
        });
    }
    const downloadColumns = [
        {
            title: 'Path',
            dataIndex: 'path',
            key: 'path',
            render: (__unused__value, record) => {
                return record.path;
            }
        },
        {
            title: 'Link',
            dataIndex: 'download',
            key: 'download',
            render: (__unused__value, record) => {
                return (<CSVLink data={record.data} filename={record.path.concat('.csv')} >
                    <DownloadOutlined />
                </CSVLink>);
            }
        }
    ];
    return (<SubsectionWithComment title={<Tooltip title={'Download data with a specific format. Please select a format, then select JSON or CSV, then click fetch data.'}>
        <Text className={css.title}>Data Download</Text> <QuestionCircleOutlined />
    </Tooltip>} comment={<>
        <Select
            value={selectedDataFormat}
            style={{ float: 'left' }}
            placeholder='Select Format'
            allowClear
            getPopupContainer={trigger => trigger.parentNode}
            onSelect={(value: string) => {
                setSelectedDataFormat(value);
                if (!value.startsWith('standardized')) {
                    setSelectedOutputType('JSON');
                }
            }}
            onChange={() => {
                setShouldUpdateData(true);
            }}
        >
            <Option value={'raw'}>Raw</Option>
            {/* <Option value={'grouped'}>Grouped</Option> */}
            {
                availableFormats.map(el => <Option value={'standardized-' + el}>{el.toString()}</Option>)
            }
        </ Select>
        <Button type={shouldUpdateData ? 'primary' : 'ghost'} onClick={() => {
            getDataRecordsLazy({
                variables: {
                    studyId: project.studyId,
                    projectId: project.id,
                    queryString: {
                        data_requested: null,
                        cnew_fields: [],
                        cohort: [[]],
                        format: selectedDataFormat
                    }
                },
                onCompleted: () => {
                    setShouldUpdateData(false);
                },
                notifyOnNetworkStatusChange: true
            });
        }}>Fetch data</Button>
        <Select
            value={selectedOutputType}
            style={{ float: 'left' }}
            placeholder='Select Format'
            getPopupContainer={trigger => trigger.parentNode}
            allowClear
            onSelect={(value: string) => {
                setSelectedOutputType(value);
            }}
        // onChange={() => {
        //     setShouldUpdateData(true);
        // }}
        >
            <Option value={'JSON'}>JSON</Option>
            {
                availableFormats.includes(selectedDataFormat?.split('-')[1] || '') ? <Option value={'CSV'}>CSV</Option> : null
            }
        </Select>
    </>}>
        {
            (getDataRecordsData?.getDataRecords?.data === undefined || shouldUpdateData === true) ? <Empty /> :
                selectedOutputType === 'JSON' ?
                    <Button type='link' onClick={() => {
                        const jsonString = `data:text/json;chatset=utf-8,${encodeURIComponent(
                            JSON.stringify(getDataRecordsData.getDataRecords.data)
                        )}`;
                        const link = document.createElement('a');
                        link.href = jsonString;
                        link.download = 'data.json';

                        link.click();
                    }}>
                        Download
                    </Button> :
                    <Table
                        scroll={{ x: 'max-content' }}
                        // rowKey={(rec) => rec.id}
                        pagination={false}
                        columns={downloadColumns}
                        dataSource={dataArray}
                        size='middle'
                    ></Table>
        }
    </SubsectionWithComment >);
};

