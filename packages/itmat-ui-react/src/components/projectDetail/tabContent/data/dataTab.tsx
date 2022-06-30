import { filterFields, generateCascader, findDmField } from '../../../../utils/tools';
import * as React from 'react';
import { useQuery, useLazyQuery } from '@apollo/client/react/hooks';
import { GET_STUDY_FIELDS, GET_PROJECT, GET_DATA_RECORDS, IFieldEntry, IProject, enumValueType, GET_ONTOLOGY_TREE, IOntologyTree, IOntologyRoute, GET_STANDARDIZATION } from 'itmat-commons';
import { Query } from '@apollo/client/react/components';
import LoadSpinner from '../../../reusable/loadSpinner';
import { Subsection, SubsectionWithComment } from '../../../reusable/subsection/subsection';
import css from './tabContent.module.css';
import { CSVLink } from 'react-csv';
import { Select, Statistic, Row, Col, Button, Table, Empty, Cascader, Tooltip } from 'antd';
import { Pie, BidirectionalBar, Heatmap, Violin, Column, Box } from '@ant-design/plots';
import { UserOutlined, ProfileOutlined, DownloadOutlined, QuestionCircleOutlined } from '@ant-design/icons';
import { useParams } from 'react-router-dom';
const { Option } = Select;

export const DataTabContent: React.FunctionComponent<{ studyId: string }> = ({ studyId }) => {
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
    if (getStudyFieldsLoading || getProjectLoading || getOntologyTreeLoading) {
        return <LoadSpinner />;
    }
    if (!projectId || getStudyFieldsError || getProjectError || getOntologyTreeError) {
        return <div className={`${css.tab_page_wrapper} ${css.both_panel} ${css.upload_overlay}`}>
            An error occured, please contact your administrator
        </div >;
    }
    if (getOntologyTreeData.getOntologyTree[0] === undefined) {
        return <span>Ontology Tree Missing!</span>;
    }
    return <div className={css.tab_page_wrapper}>
        <div className={css.scaffold_wrapper}>
            <div className={css.demographics}>
                <Subsection title={<Tooltip title={'The statistics of several demographics fields.'}>
                    <span>Demographics</span> <QuestionCircleOutlined />
                </Tooltip>}>
                    <DemographicsBlock ontologyTree={getOntologyTreeData.getOntologyTree[0]} studyId={studyId} projectId={projectId} fields={filterFields(getStudyFieldsData.getStudyFields, getOntologyTreeData.getOntologyTree[0])} />
                </Subsection>
            </div>
            <div className={css.metadata}>
                <ProjectMetaDataBlock project={getProjectData.getProject} />
            </div>
            <div className={css.field_viewer}>
                <FieldViewer ontologyTree={getOntologyTreeData.getOntologyTree[0]} fields={getStudyFieldsData.getStudyFields} />
            </div>
            <div className={css.data_completeness}>
                <DataCompletenessBlock studyId={studyId} projectId={projectId} ontologyTree={getOntologyTreeData.getOntologyTree[0]} fields={getStudyFieldsData.getStudyFields} />
            </div>
            <div className={css.data_details}>
                <DataDetailsBlock studyId={studyId} projectId={projectId} project={getProjectData.getProject} fields={getStudyFieldsData.getStudyFields} ontologyTree={getOntologyTreeData.getOntologyTree[0]} />
            </div>
            <div className={css.data_download}>
                <DataDownloadBlock project={getProjectData.getProject} />
            </div>
        </div>
    </div >;
};

export const DemographicsBlock: React.FunctionComponent<{ ontologyTree: IOntologyTree, studyId: string, projectId: string, fields: IFieldEntry[] }> = ({ ontologyTree, studyId, projectId, fields }) => {
    const { loading: getDataRecordsLoading, error: getDataRecordsError, data: getDataRecordsData } = useQuery(GET_DATA_RECORDS, {
        variables: {
            studyId: studyId,
            projectId: projectId,
            queryString: {
                format: 'grouped',
                data_requested: fields.map(el => el.fieldId),
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
    // process the data
    const obj: any = {};
    const data = getDataRecordsData.getDataRecords.data;
    const genderField: any = findDmField(ontologyTree, fields, 'SEX');
    const raceField: any = findDmField(ontologyTree, fields, 'RACE');
    const ageField: any = findDmField(ontologyTree, fields, 'AGE');
    const siteField: any = findDmField(ontologyTree, fields, 'SITE');
    // const genderFie: IFieldEntry = fields.filter(el => el.fieldId === genderFieldId.fieldId)[0];

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
    return (<>
        {
            genderField === null ? null :
                <div style={{ width: '25%', float: 'left' }}>
                    <Pie
                        appendPadding={10}
                        data={obj.SEX}
                        angleField={'value'}
                        colorField={'type'}
                        radius={0.75}
                        legend={{
                            itemWidth: 100,
                            layout: 'vertical',
                            offsetX: -40
                        }}
                        label={false}
                        interactions={[
                            {
                                type: 'element-selected',
                            },
                            {
                                type: 'element-active',
                            },
                        ]}
                    />
                    <h1 style={{ textAlign: 'center' }} >Sex</h1>
                </div>
        }
        {
            raceField === null ? null :
                <div style={{ width: '25%', float: 'left' }}>
                    <Pie
                        appendPadding={10}
                        data={obj.RACE}
                        angleField={'value'}
                        colorField={'type'}
                        radius={0.75}
                        legend={{
                            itemWidth: 100,
                            layout: 'vertical',
                            offsetX: -40
                        }}
                        label={false}
                        interactions={[
                            {
                                type: 'element-selected',
                            },
                            {
                                type: 'element-active',
                            },
                        ]}
                    />
                    <h1 style={{ textAlign: 'center' }} >Race</h1>
                </div>
        }
        {
            siteField === null ? null :
                <div style={{ width: '25%', float: 'left' }}>
                    <Pie
                        appendPadding={10}
                        data={obj.SITE}
                        angleField={'value'}
                        colorField={'type'}
                        radius={0.75}
                        legend={{
                            itemWidth: 100,
                            layout: 'vertical',
                            offsetX: -40
                        }}
                        label={false}
                        interactions={[
                            {
                                type: 'element-selected',
                            },
                            {
                                type: 'element-active',
                            },
                        ]}
                    />
                    <h1 style={{ textAlign: 'center' }} >Site</h1>
                </div>
        }
        {
            ageField === null ? null :
                <div style={{ width: '25%', float: 'left' }}>
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
                        tooltip={{
                            shared: true,
                            showMarkers: false
                        }}
                    />
                    <h1 style={{ textAlign: 'center' }} >Age</h1>
                </div>
        }
    </>);
};

export const FieldViewer: React.FunctionComponent<{ ontologyTree: IOntologyTree, fields: IFieldEntry[] }> = ({ ontologyTree, fields }) => {
    const [selectedPath, setSelectedPath] = React.useState<any[]>([]);
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
    return (<SubsectionWithComment title={<Tooltip title={'View the details of a selected field.'}>
        <span>Field Viewer</span> <QuestionCircleOutlined />
    </Tooltip>} comment={<>
        <Cascader
            getPopupContainer={trigger => trigger.parentNode}
            options={fieldPathOptions}
            onChange={(value) => {
                setSelectedPath(value);
            }}
            placeholder={'Please select'}
        />
    </>} float={'center'} >
        {
            field === undefined ? null :
                <>
                    <Row gutter={16}>
                        <Col span={12}>
                            <Statistic title='Field ID' value={field?.fieldId || 'NA'} />
                        </Col>
                        <Col span={12}>
                            <Statistic title='Field Name' value={field?.fieldName || 'NA'} />
                        </Col>
                    </Row><br />
                    <Row gutter={16}>
                        <Col span={12}>
                            <Statistic title='Data Type' value={field?.dataType || 'NA'} />
                        </Col>
                        <Col span={12}>
                            <Statistic title='Unit' value={field?.unit || 'NA'} />
                        </Col>
                    </Row><br />
                    <Row gutter={16}>
                        <Col span={12}>
                            <Statistic title='Comments' value={field?.comments || 'NA'} />
                        </Col>
                    </Row><br />
                    <Row gutter={16}>
                        <Col span={24}>
                            <Statistic title='Ontology Chain' prefix={<>
                                {
                                    routes[0].path.join(' => ')
                                }
                            </>} value={' => ' + field.fieldName} />
                        </Col>
                    </Row><br />
                </>
        }
    </SubsectionWithComment >);
};

export const DataCompletenessBlock: React.FunctionComponent<{ studyId: string, projectId: string, ontologyTree: IOntologyTree, fields: IFieldEntry[] }> = ({ studyId, projectId, ontologyTree, fields }) => {
    const [selectedPath, setSelectedPath] = React.useState<any[]>([]);

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
        }
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
                percentage: parseInt(((data[fieldId][visitId].validNumOfRecords / data[fieldId][visitId].totalNumOfRecords) * 100).toFixed(0)).toString()
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
                },
            }
        },
        yAxis: {
            title: {
                text: 'Field ID',
                style: {
                    fill: '#6E759F',
                    fontSize: 14
                },
            }
        }
    };
    const tooltipConfig = {
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
        <SubsectionWithComment title={<Tooltip title={'The percentage of valid data. The data completeness of a field is calculated by number of ( valid data pointes / number of expected data pointes).'}>
            < span > Data Completeness</span > <QuestionCircleOutlined />
        </Tooltip >} comment={
            <Cascader
                getPopupContainer={trigger => trigger.parentNode}
                options={fieldPathOptions}
                onChange={(value) => setSelectedPath(value)}
                placeholder={'Please select'}
            />
        } float={'center'}
        >
            {
                selectedPath.length === 0 ? <Empty description={'No Data Found'} /> :
                    <>
                        <Heatmap
                            style={{ overflow: 'auto' }}
                            data={obj}
                            height={Array.from(new Set((obj.map(el => el.field)))).length * 20}
                            xField={'visit'}
                            yField={'field'}
                            autoFit={true}
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
                    </>
            }
        </SubsectionWithComment >
    );
};

export const DataDetailsBlock: React.FunctionComponent<{ studyId: string, projectId, project: IProject, fields: IFieldEntry[], ontologyTree: IOntologyTree }> = ({ studyId, projectId, project, fields, ontologyTree }) => {
    const [selectedPath, setSelectedPath] = React.useState<any[]>([]);
    const [selectedGraphType, setSelectedGraphType] = React.useState('');
    //construct the cascader
    const fieldPathOptions: any = [];
    ontologyTree.routes?.forEach(el => {
        generateCascader(el, fieldPathOptions, true);
    });
    const selectedFieldId = ontologyTree.routes?.filter(el => el.name === selectedPath[selectedPath.length - 1])[0]?.field[0]?.replace('$', '') || '';
    return (<SubsectionWithComment title={<Tooltip title={'The data distribution of a selected field. We provide different visualization techniques for categorical data and numerical data, respectively.'}>
        <span>Data Distribution</span> <QuestionCircleOutlined />
    </Tooltip>} comment={<>
        <Cascader
            options={fieldPathOptions}
            getPopupContainer={trigger => trigger.parentNode}
            onChange={(value) => {
                setSelectedPath(value);
                setSelectedGraphType('');
            }}
            placeholder={'Please select'}
        />
        <Select
            // value={selectedGraphType}
            getPopupContainer={trigger => trigger.parentNode}
            placeholder='Select Graph Type'
            onChange={(value) => {
                setSelectedGraphType(value);
            }}
        >
            {
                [enumValueType.INTEGER, enumValueType.DECIMAL].includes(fields.filter(el => el.fieldId === selectedFieldId)[0]?.dataType) ?
                    <>
                        <Option value='violin'>Violin</Option>
                        <Option value='box'>Box</Option>
                    </> : <>
                        <Option value='stackedColumn'>Stacked Column</Option>
                        <Option value='groupedColumn'>Grouped Column</Option>
                    </>
            }
        </Select>
    </>
    } float={'center'}>
        <Query<any, any> query={GET_DATA_RECORDS} variables={{
            studyId: studyId,
            projectId: projectId,
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
                    return <Empty description={'No Data Found'} />;
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
                        high: sortedY[sortedY.length - 1],
                    };
                });
                console.log(boxData);
                if ([enumValueType.INTEGER, enumValueType.DECIMAL].includes(fields.filter(el => el.fieldId === fieldIdFromData)[0].dataType))
                    return (<>
                        {
                            selectedGraphType === 'violin' ? <Violin
                                data={data}
                                xField={'x'}
                                yField={'y'}
                            /> : selectedGraphType === 'box' ? <Box
                                data={boxData}
                                xField={'x'}
                                yField={['low', 'q1', 'median', 'q3', 'high']}
                                boxStyle={{
                                    stroke: '#545454',
                                    fill: '#1890FF',
                                    fillOpacity: 0.3,
                                }}
                            /> : null
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
                                    seriesField={'value'}
                                    isPercent={true}
                                    isStack={selectedGraphType === 'stackedColumn'}
                                    isGroup={selectedGraphType === 'groupedColumn'}
                                    interactions={[
                                        { type: 'element-highlight-by-color' },
                                        { type: 'element-link' }
                                    ]}
                                /> : null
                        }
                    </>);
            }}
        </Query>
        <br />
    </SubsectionWithComment>);
};

export const ProjectMetaDataBlock: React.FunctionComponent<{ project: IProject }> = ({ project }) => {
    return (<Subsection title={<Tooltip title={'Summary of the project.'}>
        <span>Meta data</span> <QuestionCircleOutlined />
    </Tooltip>}>
        <div style={{ gridArea: 'e' }}>
            <Row gutter={16}>
                <Col span={12}>
                    <Statistic title='Participants' value={project.summary.subjects.length} prefix={<UserOutlined />} />
                </Col>
                <Col span={12}>
                    <Statistic title='Data Version' value={project.dataVersion?.version} />
                </Col>
            </Row><br />
            <Row gutter={16}>
                <Col span={12}>
                    <Statistic title='Visits' value={project.summary.visits.length} prefix={<ProfileOutlined />} />
                </Col>
                <Col span={12}>
                    <Statistic title='Version Tag' value={project.dataVersion?.tag} />
                </Col>
            </Row><br />
            <Row gutter={16}>
                <Col span={12}>
                </Col>
            </Row><br />
            <Row gutter={16}>
                <Col span={24}>
                    <Statistic title='Updated At' value={project.dataVersion?.updateDate === undefined ? 'NA' : (new Date(parseFloat(project.dataVersion?.updateDate))).toUTCString()} />
                </Col>
            </Row>
        </div>
    </Subsection>);
};

export const DataDownloadBlock: React.FunctionComponent<{ project: IProject }> = ({ project }) => {
    const { loading: getStandardizationLoading, error: getStandardizationError, data: getStandardizationData } = useQuery(GET_STANDARDIZATION, { variables: { studyId: project.studyId, projectId: project.id } });
    const [getDataRecordsLazy, { loading: getDataRecordsLoading, data: getDataRecordsData }] = useLazyQuery(GET_DATA_RECORDS, {});
    const [selectedDataFormat, setSelectedDataFormat] = React.useState<string | undefined>(undefined);
    const [selectedOutputType, setSelectedOutputType] = React.useState('JSON');
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
        },
    ];
    return (<SubsectionWithComment title={<Tooltip title={'Download data with a specific format. Please select a format, then select JSON or CSV, then click fetch data.'}>
        <span>Data Download</span> <QuestionCircleOutlined />
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
        >
            <Option value={'raw'}>Raw</Option>
            {/* <Option value={'grouped'}>Grouped</Option> */}
            {
                availableFormats.map(el => <Option value={'standardized-' + el}>{el.toString()}</Option>)
            }
        </ Select>
        <Button onClick={() => {
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
                }
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
        >
            <Option value={'JSON'}>JSON</Option>
            {
                availableFormats.includes(selectedDataFormat?.split('-')[1] || '') ? <Option value={'CSV'}>CSV</Option> : null
            }
        </Select>
    </>}>
        {
            getDataRecordsData?.getDataRecords?.data === undefined ? <Empty description={'No Data Found'} /> :
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
