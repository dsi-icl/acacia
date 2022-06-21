import { filterFields, generateCascader, findDmField } from '../../../../utils/tools';
import * as React from 'react';
import { useQuery, useLazyQuery } from '@apollo/client/react/hooks';
import { GET_STUDY_FIELDS, GET_PROJECT, GET_DATA_RECORDS, IFieldEntry, IProject, enumValueType, GET_ONTOLOGY_TREE, IOntologyTree, IOntologyRoute, GET_STANDARDIZATION } from 'itmat-commons';
import { Query } from '@apollo/client/react/components';
import LoadSpinner from '../../../reusable/loadSpinner';
import { Subsection, SubsectionWithComment } from '../../../reusable/subsection/subsection';
import css from './tabContent.module.css';
import { CSVLink } from 'react-csv';
import { Pagination, Select, Statistic, Row, Col, Button, Table, Empty, Cascader } from 'antd';
import { Pie, BidirectionalBar, Heatmap, Violin, Column } from '@ant-design/plots';
import { UserOutlined, ProfileOutlined, DownloadOutlined } from '@ant-design/icons';
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
            A error occured, please contact your administrator
        </div>;
    }
    if (getOntologyTreeData.getOntologyTree[0] === undefined) {
        return <span>Ontology Tree Missing!</span>;
    }
    return <div className={css.tab_page_wrapper}>
        <div className={css.scaffold_wrapper}>
            <div style={{ gridArea: 'a' }}>
                <Subsection title='Demographics'>
                    <DemographicsBlock ontologyTree={getOntologyTreeData.getOntologyTree[0]} studyId={studyId} projectId={projectId} fields={filterFields(getStudyFieldsData.getStudyFields, getOntologyTreeData.getOntologyTree[0])} />
                </Subsection>
            </div>
            <div style={{ gridArea: 'b' }}>
                <ProjectMetaDataBlock project={getProjectData.getProject} />
            </div>
            <div style={{ gridArea: 'c' }}>
                <FieldViewer ontologyTree={getOntologyTreeData.getOntologyTree[0]} fields={getStudyFieldsData.getStudyFields} />
            </div>
            <div style={{ gridArea: 'd' }}>
                <DataCompletenessBlock studyId={studyId} projectId={projectId} ontologyTree={getOntologyTreeData.getOntologyTree[0]} />
            </div>
            <div style={{ gridArea: 'e' }}>
                <DataDetailsBlock studyId={studyId} projectId={projectId} project={getProjectData.getProject} fields={getStudyFieldsData.getStudyFields} ontologyTree={getOntologyTreeData.getOntologyTree[0]} />
            </div>
            <div style={{ gridArea: 'f' }}>
                <DataDownloadBlock project={getProjectData.getProject} />
            </div>
        </div>
    </div>;
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
            A error occured, please contact your administrator
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
                        data={obj.SEX}
                        autoFit={true}
                        angleField={'value'}
                        colorField={'type'}
                        legend={{
                            layout: 'horizontal',
                            position: 'bottom',
                            // offsetY: -80
                        }}
                        meta={{
                            count: { min: 0 }
                        }}
                        label={false}
                        radius={0.8}
                        interactions={[
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
                        data={obj.RACE}
                        angleField={'value'}
                        colorField={'type'}
                        legend={{
                            layout: 'horizontal',
                            position: 'bottom',
                        }}
                        meta={{
                            count: { min: 0 }
                        }}
                        label={false}
                        radius={0.8}
                        interactions={[
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
                        data={obj.SITE}
                        angleField={'value'}
                        colorField={'type'}
                        legend={{
                            layout: 'horizontal',
                            position: 'bottom',
                            // offsetY: -80
                        }}
                        label={false}
                        radius={0.8}
                        interactions={[
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
                            position: 'bottom'
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
    return (<SubsectionWithComment title='Field Viewer' comment={<>
        <Cascader
            options={fieldPathOptions}
            onChange={(value) => {
                setSelectedPath(value);
            }}
            placeholder={'Please select'}
        />
    </>}>
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
    </SubsectionWithComment>);
};

export const DataCompletenessBlock: React.FunctionComponent<{ studyId: string, projectId: string, ontologyTree: IOntologyTree }> = ({ studyId, projectId, ontologyTree }) => {
    const dataCompletenessdPageSize = 20;
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
            A error occured, please contact your administrator
        </div>;
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
            return {
                name: '3',
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
        <SubsectionWithComment title='Data Completeness' comment={
            <Cascader
                options={fieldPathOptions}
                onChange={(value) => setSelectedPath(value)}
                placeholder={'Please select'}
            />
        }>
            <Heatmap
                data={obj}
                xField={'visit'}
                yField={'field'}
                colorField={'percentage'}
                label={{
                    style: {
                        fill: '#fff',
                        shadowBlur: 2,
                        shadowColor: 'rgba(0, 0, 0, .45)',
                    },
                }}
                legend={{
                    layout: 'vertical',
                    position: 'right',
                    offsetY: 5,
                    min: Math.min(...obj.map(el => el.percentage)),
                    max: 100,
                    reversed: false
                }}
                tooltip={tooltipConfig}
                xAxis={axisConfig.xAxis}
                yAxis={axisConfig.yAxis}
            />
            <Pagination
                style={{ float: 'right' }}
                defaultCurrent={1}
                defaultPageSize={1}
                total={Math.ceil(requestedFields.length / dataCompletenessdPageSize)}
            />
        </SubsectionWithComment>
    );
};

export const DataDetailsBlock: React.FunctionComponent<{ studyId: string, projectId, project: IProject, fields: IFieldEntry[], ontologyTree: IOntologyTree }> = ({ studyId, projectId, project, fields, ontologyTree }) => {
    const [selectedPath, setSelectedPath] = React.useState<any[]>([]);
    //construct the cascader
    const fieldPathOptions: any = [];
    ontologyTree.routes?.forEach(el => {
        generateCascader(el, fieldPathOptions, true);
    });
    return (<SubsectionWithComment title='Data Distribution' comment={
        <Cascader
            options={fieldPathOptions}
            onChange={(value) => setSelectedPath(value)}
            placeholder={'Please select'}
        />
    }>
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
                return (<>
                    {
                        [enumValueType.INTEGER, enumValueType.DECIMAL].includes(fields.filter(el => el.fieldId === fieldIdFromData)[0].dataType) ?
                            <Violin
                                data={data}
                                xField={'x'}
                                yField={'y'}
                            />
                            :
                            <Column
                                data={data}
                                xField={'visit'}
                                yField={'count'}
                                seriesField={'value'}
                                isPercent={true}
                                isStack={true}
                                interactions={[
                                    { type: 'element-highlight-by-color' },
                                    { type: 'element-link' }
                                ]}
                            />
                    }
                </>);
            }}
        </Query>
        <br />
    </SubsectionWithComment>);
};

export const ProjectMetaDataBlock: React.FunctionComponent<{ project: IProject }> = ({ project }) => {
    return (<Subsection title='Meta Data'>
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
    const { loading: getStandardizationLoading, error: getStandardizationError, data: getStandardizationData } = useQuery(GET_STANDARDIZATION, { variables: { studyId: project.studyId } });
    const [getDataRecordsLazy, { loading: getDataRecordsLoading, data: getDataRecordsData }] = useLazyQuery(GET_DATA_RECORDS, {});
    const [selectedDataFormat, setSelectedDataFormat] = React.useState<string | undefined>(undefined);
    const [selectedOutputType, setSelectedOutputType] = React.useState('JSON');
    if (getDataRecordsLoading || getStandardizationLoading) {
        return <LoadSpinner />;
    }
    if (getStandardizationError) {
        return <p>
            A error occured, please contact your administrator
        </p>;
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
    return (<SubsectionWithComment title='Data Download' comment={<>
        <Select
            value={selectedDataFormat}
            style={{ float: 'left' }}
            placeholder='Select Format'
            allowClear
            onSelect={(value: string) => {
                setSelectedDataFormat(value);
                if (!value.startsWith('standardized')) {
                    setSelectedOutputType('JSON');
                }
            }}
        >
            <Option value={'raw'}>Raw</Option>
            <Option value={'grouped'}>Grouped</Option>
            {
                availableFormats.map(el => <Option value={'standardized-' + el}>{el.toString()}</Option>)
            }
        </Select>
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
            getDataRecordsData?.getDataRecords?.data === undefined ? <h2>No Data Available</h2> :
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
    </SubsectionWithComment>);
};
