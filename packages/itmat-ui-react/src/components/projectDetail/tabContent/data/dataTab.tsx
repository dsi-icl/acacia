import * as React from 'react';
import { Query } from '@apollo/client/react/components';
import { useQuery, useMutation } from '@apollo/client/react/hooks';
import { GET_PROJECT, IFieldEntry, CREATE_QUERY, CREATE_QUERY_CURATION_JOB, WHO_AM_I, GET_DATA_RECORDS, GET_QUERY, GET_QUERY_BY_ID, GET_STUDY_FIELDS, GET_ONTOLOGY_TREE, enumValueType } from 'itmat-commons';
import { FieldListSectionWithFilter } from '../../../reusable/fieldList/fieldList';
import LoadSpinner from '../../../reusable/loadSpinner';
import { Subsection, SubsectionWithComment } from '../../../reusable/subsection/subsection';
import css from './tabContent.module.css';
import { CSVLink } from 'react-csv';
import {
    XYPlot,
    XAxis,
    YAxis,
    VerticalGridLines,
    HorizontalGridLines,
    LineMarkSeries,
    DiscreteColorLegend
} from 'react-vis';
import 'react-vis/dist/style.css';
import { List, Card, Button, Table, Modal, Select } from 'antd';
const Option = Select;


export const DataTabContent: React.FunctionComponent<{ studyId: string; projectId: string }> = ({ studyId, projectId }) => {
    const { loading: getProjectLoading, error: getProjectError, data: getProjectData } = useQuery(GET_PROJECT, { variables: { projectId: projectId, admin: false } });
    const { loading: getQueryLoading, error: getQueryError, data: getQueryData } = useQuery(GET_QUERY, { variables: { projectId: projectId, studyId: studyId } });
    const { loading: whoAmILoading, error: whoAmIError, data: whoAmIData } = useQuery(WHO_AM_I);
    const { loading: getStudyFieldsLoading, error: getStudyFieldsError, data: getStudyFieldsData } = useQuery(GET_STUDY_FIELDS, { variables: { studyId: studyId, projectId: projectId } });
    const { loading: getOntologyTreeLoading, error: getOntologyTreeError, data: getOntologyTreeData } = useQuery(GET_ONTOLOGY_TREE, { variables: { studyId: studyId, projectId: projectId } });

    const [ checkedFields, setCheckedFields ] = React.useState<any[]>([]);
    const [ isFilterShown, setIsFilterShown ] = React.useState(false);
    const [ queryOptions, setQueryOptions ] = React.useState<any>({filters: [], returned_fields: [], derivedFields: []});

    // visualization
    const [ visualizedData, setVisualizedData ] = React.useState<any[]>([]);
    const [ listOfNumberFieldsVis, setListOfNumberFieldsVis ] = React.useState<any[]>([]); // including int and float
    const [ listOfCategoricalFieldsVis, setListOfCategoricalFieldsVis ] = React.useState<any[]>([]); // include categorical and boolean
    const [ visuzlizedNumericalSubject, setVisualizedNumericalSubject ] = React.useState(''); // while visualizaing numerical data, a subjectId must be selected

    // if select view by visit, show the percentage of each possible values among all subjects; if by subject, show the trend of this subject him/herself;
    // visuzlizedCategoricalSubject works only if visuzlizedCategoricalType is bysubject
    // const [ visuzlizedCategoricalSubject, setVisualizedCategoricalSubject ] = React.useState(''); // while visualizaing categorical data, a subjectId must be selected
    const [ visuzlizedCategoricalType, setVisualizedCategoricalType ] = React.useState(''); // while visualizaing categorical data, specify type

    const [ isQueryResultShown, setIsQueryResultShown ] = React.useState(false);
    const [ viewQueryId, setViewQueryId ] = React.useState('');


    const [createQueryCurationJob] = useMutation(CREATE_QUERY_CURATION_JOB, {
        onError: (error: any) => {
            throw new Error(JSON.stringify(error));
        }
    });

    const [createQuery] = useMutation(CREATE_QUERY, {
        onError: (error: any) => {
            throw new Error(JSON.stringify(error));
        },
        onCompleted: (data) => {
            const queryId = data.createQuery.id;
            createQueryCurationJob({variables: {
                queryId: queryId,
                studyId: studyId,
                projectId: projectId
                // dataVersionId: getStudyData.getStudy.dataVersions[getStudyData.getStudy.currentDataVersion].version
            }});
        }
    });

    if (getProjectLoading || whoAmILoading || getQueryLoading || getStudyFieldsLoading || getOntologyTreeLoading) {
        return <LoadSpinner />;
    }

    if (getProjectError || whoAmIError || getQueryError || getStudyFieldsError || getOntologyTreeError) {
        return <div className={`${css.tab_page_wrapper} ${css.both_panel} ${css.upload_overlay}`}>
            A error occured, please contact your administrator
        </div>;
    }
    if (Object.keys(getProjectData.getProject.fields).length === 0) { return <p>No fields uploaded or available to you. If this should not be the case, check your permission with admin.</p>; }

    const headers = getStudyFieldsData.getStudyFields.map((el) => {
        return {
            label: el.fieldName,
            key: el.fieldId.toString()
        };
    });
    headers.push({label: 'm_subjectId', key: 'm_subjectId'});
    headers.push({label: 'm_visitId', key: 'm_visitId'});

    const queryColumns = [
        {
            title: 'Id',
            dataIndex: 'id',
            key: 'id',
            render: (__unused__value, record) => {
                return JSON.stringify(record.id);
            }
        },
        {
            title: 'Status',
            dataIndex: 'status',
            key: 'status',
            render: (__unused__value, record) => {
                return JSON.stringify(record.status);
            }
        },
        {
            title: '',
            dataIndex: 'queryResult',
            key: 'queryResult',
            render: (__unused__value, record) => {
                return (<Button type='primary' htmlType='submit'
                    onClick={() => {
                        setViewQueryId(record.id);
                        setIsQueryResultShown(true);
                    }}
                >
                  Results
                </Button>);
            }
        },
        {
            title: '',
            dataIndex: 'execute',
            key: 'execute',
            render: (__unused__value, record) => {
                return (<Button type='primary' htmlType='submit'
                    onClick={() => {createQueryCurationJob({variables: {
                        queryId: record.id,
                        studyId: studyId,
                        projectId: projectId
                        // dataVersionId: getStudyData.getStudy.dataVersions[getStudyData.getStudy.currentDataVersion].version
                    }});}}
                >
                  Execute
                </Button>);
            }
        },
        {
            title: 'Export',
            dataIndex: 'download',
            key: 'download',
            render: (__unused__value, record) => {
                const queryResult = JSON.parse(record.queryResult);
                const uniqueFields = queryResult.map(el => Object.keys(el)).reduce((function (total, arr) {
                    return Array.from(new Set(total.concat(arr)));
                }), []);
                const filteredHeaders = headers.filter(el => uniqueFields.includes(el.key.toString()));
                return (<CSVLink data={queryResult} headers={filteredHeaders}>
                    Download me
                </CSVLink>);
            }
        },
    ];
    // pre processing of data that are to visualized
    const fieldKeysInQueryResult = Object.keys(visualizedData.reduce(function(result, obj) {
        return Object.assign(result, obj);
    }, {}));
    const idsOfNumbericalFields = getStudyFieldsData.getStudyFields.filter((el) => {
        if (fieldKeysInQueryResult.filter((es) => es.toString() === el.fieldId).length === 0) {
            return false;
        }
        if (el.dataType !== enumValueType.DECIMAL && el.dataType !== enumValueType.INTEGER) {
            return false;
        }
        return true;
    });
    const idsOfCategoricalFields = getStudyFieldsData.getStudyFields.filter((el) => {
        if (fieldKeysInQueryResult.filter((es) => es.toString() === el.fieldId).length === 0) {
            return false;
        }
        if (el.dataType !== enumValueType.BOOLEAN && el.dataType !== enumValueType.CATEGORICAL) {
            return false;
        }
        return true;
    });
    const numbericalData: any[] = [];
    for (const field of idsOfNumbericalFields) {
        if (!listOfNumberFieldsVis.includes(field.fieldId)) {
            continue;
        }
        const data: any[] = [];
        const dataToUse = visualizedData.filter(el => (el.m_subjectId === visuzlizedNumericalSubject));
        for (const eachData of dataToUse) {
            data.push({ x: parseInt(eachData.m_visitId), y: eachData[field.fieldId] });
        }
        numbericalData.push(data);
    }
    console.log(numbericalData);
    const categoricalData: any[] = [];
    for (const field of idsOfCategoricalFields) {
        if (!listOfCategoricalFieldsVis.includes(field.fieldId)) {
            continue;
        }
        // const data: any[] = [];
        const possibleValues = getStudyFieldsData.getStudyFields.filter(el => el.fieldId === field.fieldId)[0].possibleValues;
        const visitIds = Array.from(new Set(visualizedData.map(el => el.m_visitId)));
        // const subjectIds = Array.from(new Set(visualizedData.map(el => el.m_subjectId)));
        if (visuzlizedCategoricalType === 'byVisit') {
            const data: any = {};
            for (const posValue of possibleValues) {
                const subData: any[] = [];
                for (const eachVisit of visitIds) {
                    subData.push({
                        x: parseInt(eachVisit),
                        y: visualizedData.filter(el => (el[field.fieldId].toString() === posValue.code.toString()) && el.m_visitId === eachVisit).length / visualizedData.filter(el => el.m_visitId === eachVisit).length
                    });
                }
                data[posValue.code.toString()] = subData;
            }
            categoricalData.push(data);
        }
    }
    console.log(categoricalData);
    console.log(idsOfCategoricalFields);
    return <div className={css.scaffold_wrapper}>
        <div className={css.tab_page_wrapper + ' ' + css.left_panel}>
            <Subsection title='Data Selection'>
                <Button type='primary' htmlType='submit' onClick={() => setIsFilterShown(true)}>Select Data</Button>
                <Modal
                    width='80%'
                    visible={isFilterShown}
                    title='Query Result Viewer'
                    onOk={() => setIsFilterShown(false)}
                    onCancel={() => setIsFilterShown(false)}
                >
                    <Subsection title='Fields & Variables'>
                        <FieldListSelectionStateProject ontologyTree={getOntologyTreeData.getOntologyTree} fields={getProjectData.getProject.fields} checkedFields={checkedFields} onCheck={setCheckedFields} queryOptions={[queryOptions, setQueryOptions]} />
                    </Subsection>
                    <Subsection title='Filters'>
                        {queryOptions.filters.length === 0 ? <p>No filters added.</p>:
                            <List
                                grid={{ gutter: 8, column: 4 }}
                                dataSource={queryOptions.filters}
                                renderItem={item => (
                                    <List.Item>
                                        <Card title={(item as any).name}>
                                            <p>{(item as any).op}</p>
                                            <p>{(item as any).value}</p>
                                        </Card>
                                    </List.Item>
                                )}
                            />}
                    </Subsection>
                </Modal>
            </Subsection><br/>
            <Query<any, any> query={GET_DATA_RECORDS} variables={{ studyId: studyId, projectId: projectId, queryString: constructQueryString(checkedFields.filter((el) => el.indexOf('CAT') === -1), getProjectData.getProject.fields, queryOptions['filters'], queryOptions['derivedFields']) }} onCompleted={(data) => {
                const dataInArray: any[] = [];
                for (const subject in data.getDataRecords.data) {
                    for (const visit in data.getDataRecords.data[subject]) {
                        dataInArray.push(data.getDataRecords.data[subject][visit]);
                    }
                }
                setVisualizedData(dataInArray);
            }}>
                {({ data, loading, error }) => {
                    if (loading) { return <LoadSpinner />; }
                    if (error) { return <p>No results found.</p>; }
                    if (!data || data.getDataRecords === null) { return <p>Not available.</p>; }
                    const columns: any[] = [];
                    const fieldsList = getProjectData.getProject.fields;
                    const queryResult = data.getDataRecords.data;
                    // convert data source format to arrays
                    const dataInArray: any[] = [];
                    let fieldKeysInQueryResult: any = {};
                    for (const subject in queryResult) {
                        for (const visit in queryResult[subject]) {
                            fieldKeysInQueryResult = {...fieldKeysInQueryResult, ...queryResult[subject][visit]};
                            dataInArray.push(queryResult[subject][visit]);
                        }
                    }
                    for (const key in fieldKeysInQueryResult) {
                        let fieldName = '';
                        for (let i=0; i<fieldsList.length; i++) {
                            if (key.toString() === fieldsList[i].fieldId.toString()) {
                                fieldName = fieldsList[i].fieldName;
                            }
                        }
                        const name = fieldName === '' ? key : fieldName;
                        columns.push({
                            title: name,
                            dataIndex: key,
                            key: key,
                            render: (__unused__value, record) => {
                                if (!(key in record)) {
                                    return '';
                                }
                                if (Object.keys(fieldsList).map((el) => fieldsList[el].fieldId.toString()).includes(key)) {
                                    return record[key];
                                } else {
                                    return record[key];
                                }
                            }
                        });
                    }
                    return <>
                        <SubsectionWithComment title='Data' comment={dataInArray.length.toString().concat(' records found')} >
                            <Table
                                scroll={{ x: 'max-content' }}
                                rowKey={(rec) => rec.id}
                                pagination={
                                    {
                                        defaultPageSize: 10,
                                        showSizeChanger: true,
                                        // pageSizeOptions: ['10', '20', '50', '100'],
                                        defaultCurrent: 1,
                                        showQuickJumper: true
                                    }
                                }
                                columns={columns}
                                dataSource={dataInArray}
                                size='middle'
                            ></Table>
                            <Button type='primary' htmlType='submit' onClick={() => {
                                createQuery({variables: {query: {queryString: constructQueryString(checkedFields.filter((el) => el.indexOf('CAT') === -1), getProjectData.getProject.fields, queryOptions['filters'], queryOptions['derivedFields']), studyId: studyId, projectId: projectId, userId: whoAmIData.whoAmI.id}}});
                            }}>
                                            Save this query
                            </Button>
                        </SubsectionWithComment><br/>
                        <Subsection title='Query List'>
                            <Modal
                                width='80%'
                                visible={isQueryResultShown}
                                title='Query Result Viewer'
                                onOk={() => setIsQueryResultShown(false)}
                                onCancel={() => setIsQueryResultShown(false)}
                            >
                                <Query<any, any> query={GET_QUERY_BY_ID} variables={{ queryId: viewQueryId }}>
                                    {({ data, loading, error }) => {
                                        if (loading) { return <LoadSpinner />; }
                                        if (error) { return <p>{JSON.stringify(error)}</p>; }
                                        if (!data) { return <p>Not executed.</p>; }
                                        const queryResult = JSON.parse(data.getQueryById.queryResult);
                                        if (queryResult === null || queryResult === undefined || queryResult === []) {
                                            return <p>No Results Found</p>;
                                        }
                                        const columns: any[] = [];
                                        for (const key of Object.keys(queryResult[0])) {
                                            columns.push({
                                                title: key,
                                                dataIndex: key,
                                                key: key,
                                                render: (__unused__value, record) => {
                                                    return record[key];
                                                }
                                            });
                                        }
                                        return (<Table
                                            scroll={{ x: 'max-content' }}
                                            rowKey={(rec) => rec.id}
                                            pagination={false}
                                            columns={columns}
                                            dataSource={queryResult}
                                            size='middle'
                                        ></Table>);
                                    }}
                                </Query>
                            </Modal>
                            <Table
                                rowKey={(rec) => rec.id}
                                pagination={false}
                                columns={queryColumns}
                                dataSource={getQueryData.getQueries}
                                size='small'
                            ></Table>
                        </Subsection>
                    </>;
                }}
            </Query>
        </div>
        <div className={css.tab_page_wrapper + ' ' + css.right_panel}>
            <Subsection title=''>
                <div style={{display: 'inline-block', width: '60%'}}>
                    <Select
                        mode='multiple'
                        onChange={(value) => {
                            if (value.length > 3) {
                                alert('Max Number of Selection: 3');
                                return;
                            }
                            setListOfNumberFieldsVis(value);
                        }}
                        value={listOfNumberFieldsVis}
                        style={{width: '100%'}}
                        placeholder='Select Numerical Fields To Show'
                    >
                        {idsOfNumbericalFields.map((eh) => {
                            return <Option value={eh.fieldId}>{eh.fieldName}</Option>;
                        })}
                    </Select>
                </div>
                <div style={{display: 'inline-block', width: '40%'}}>
                    <Select
                        onChange={(value) => {
                            setVisualizedNumericalSubject(value);
                        }}
                        value={visuzlizedNumericalSubject || undefined}
                        style={{width: '100%'}}
                        placeholder='Select Subject'
                    >
                        {Array.from(new Set(visualizedData.map(el => el.m_subjectId))).map((eh) => {
                            return <Option value={eh}>{eh}</Option>;
                        })}
                    </Select>
                </div><br/><br/>
                {
                    numbericalData.map((el, indexEl) => {
                        return (<div style={{display: 'inline-block', width: '30%'}}>
                            <XYPlot width={300} height={300}>
                                <VerticalGridLines />
                                <HorizontalGridLines />
                                <XAxis title='Visit'/>
                                <YAxis title={idsOfNumbericalFields[indexEl].unit}/>
                                <LineMarkSeries
                                    className='linemark-series-example'
                                    style={{
                                        strokeWidth: '3px'
                                    }}
                                    lineStyle={{stroke: 'red'}}
                                    markStyle={{stroke: 'blue'}}
                                    data={el}
                                />
                                <h1 style={{ textAlign:'center' }} >{idsOfNumbericalFields.filter(el => el.fieldId.toString() === listOfNumberFieldsVis[indexEl])[0].fieldName}</h1>
                            </XYPlot>
                        </div>);
                    })
                }
                <br/>
                <div style={{display: 'inline-block', width: '60%'}}>
                    <Select
                        mode='multiple'
                        onChange={(value) => {
                            if (value.length > 2) {
                                alert('Max Number of Selection: 2');
                                return;
                            }
                            setListOfCategoricalFieldsVis(value);
                        }}
                        value={listOfCategoricalFieldsVis}
                        style={{width: '80%'}}
                        placeholder='Select Categorical Fields To Show'
                    >
                        {idsOfCategoricalFields.map((eh) => {
                            return <Option value={eh.fieldId}>{eh.fieldName}</Option>;
                        })}
                    </Select>
                </div>
                <div style={{display: 'inline-block', width: '20%'}}>
                    <Select
                        onChange={(value) => {
                            setVisualizedCategoricalType(value);
                        }}
                        value={visuzlizedCategoricalType}
                        style={{width: '100%'}}
                        placeholder='Select Numerical Fields To Show'
                    >
                        <Option value='bySubject'>{'By Subject'}</Option>
                        <Option value='byVisit'>{'By Visit'}</Option>
                    </Select>
                </div>
                <div style={{display: 'inline-block', width: '20%'}}>
                </div><br/><br/>
                {
                    categoricalData.map((el, indexEl) => {
                        return (<div style={{display: 'inline-block', width: '40%'}}>
                            <div style={{display: 'inline-block', width: '80%'}}>
                                <XYPlot width={300} height={300} style={{display: 'inline-block' }}>
                                    <VerticalGridLines />
                                    <HorizontalGridLines />
                                    <XAxis title={'Visit'}/>
                                    <YAxis title={'Percent'}/>
                                    <h1 style={{ textAlign:'center' }} >{idsOfCategoricalFields[indexEl].fieldName}</h1>
                                    {
                                        Object.keys(el).map((eh) => {
                                            return (
                                                <LineMarkSeries
                                                    className='linemark-series-example'
                                                    data={el[eh]}
                                                />
                                            );
                                        })
                                    }
                                </XYPlot>
                            </div>
                            <div style={{display: 'inline-block', width: '20%'}}>
                                <DiscreteColorLegend
                                    height={300}
                                    style={{display: 'inline-block' }}
                                    items={idsOfCategoricalFields[indexEl].possibleValues.map((el) => { return { title: el.code }; })}
                                />
                            </div>
                        </div>);
                    })
                }
            </Subsection>
        </div>
    </div>;
};

const FieldListSelectionStateProject: React.FunctionComponent<{ ontologyTree: any, fields: IFieldEntry[], checkedFields: any, onCheck: any, queryOptions: any }> = ({ ontologyTree, fields, checkedFields,onCheck, queryOptions }) => {
    /* PRECONDITION: it is given (checked by parent component that fields at least have one key */
    return <FieldListSectionWithFilter ontologyTree={ontologyTree} checkable={true} fieldList={fields} onCheck={onCheck} checkedList={checkedFields} queryOptions={queryOptions} />;
};

function constructQueryString(checkedList: any, fieldsList: any, filters: any, derivedFields: any) {
    const queryString: any = {};
    // returned Fields
    // const returnedFields = []
    const returnedFields: any[] = [];
    for (let i=0; i<checkedList.length; i++) {
        for (let j=0; j<fieldsList.length; j++) {
            if (checkedList[i] === fieldsList[j].id) {
                returnedFields.push(fieldsList[j].fieldId);
            }
        }
    }
    returnedFields.push('m_subjectId');
    returnedFields.push('m_visitId');
    // cohort
    const cohort: any[] = [];
    for (let i=0; i<filters.length; i++) {
        for (let j=0; j<fieldsList.length; j++) {
            if (fieldsList[j].id === filters[i].field) {
                cohort.push({
                    field: fieldsList[j].fieldId,
                    value: filters[i].value,
                    op: filters[i].op
                });
            }
        }
    }
    queryString.data_requested = returnedFields;
    queryString.cohort = [cohort];
    queryString.new_fields = derivedFields;
    return queryString;
}
