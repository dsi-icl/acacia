import * as React from 'react';
import { Query } from '@apollo/client/react/components';
import { useQuery } from '@apollo/client/react/hooks';
import { GET_PROJECT, IFieldEntry, GET_DATA_RECORDS, GET_STUDY_FIELDS, GET_ONTOLOGY_TREE, enumValueType } from 'itmat-commons';
import { FieldListSectionWithFilter } from '../../../reusable/fieldList/fieldList';
import LoadSpinner from '../../../reusable/loadSpinner';
import { DeleteOutlined } from '@ant-design/icons';
import { Subsection, SubsectionWithComment } from '../../../reusable/subsection/subsection';
import css from './tabContent.module.css';
import {
    LineChart,
    CartesianGrid,
    XAxis,
    YAxis,
    Tooltip,
    Legend,
    Line,
    BarChart,
    Bar,
    LabelList
} from 'recharts';
import { Button, Table, Modal, Switch } from 'antd';
import { useParams } from 'react-router-dom';

export const DataTabContent: React.FunctionComponent<{ studyId: string }> = ({ studyId }) => {

    const { projectId } = useParams();

    const { loading: getProjectLoading, error: getProjectError, data: getProjectData } = useQuery(GET_PROJECT, { variables: { projectId: projectId, admin: false } });
    const { loading: getOntologyTreeLoading, error: getOntologyTreeError, data: getOntologyTreeData } = useQuery(GET_ONTOLOGY_TREE, { variables: { studyId: studyId, projectId: projectId } });
    const { loading: getStudyFieldsLoading, error: getStudyFieldsError, data: getStudyFieldsData } = useQuery(GET_STUDY_FIELDS, { variables: { studyId: studyId, projectId: projectId } });

    const [isDataSelectorShown, setIsDataSelectorShown] = React.useState(false);
    const [checkedFields, setCheckedFields] = React.useState<any[]>([]);
    const [queryOptions, setQueryOptions] = React.useState<any>({ filters: [], returned_fields: [], derivedFields: [] });
    const [viewMode, setViewMode] = React.useState(true); // dataMode (true): show data in tables; visualMode (false): show data in charts

    if (getProjectLoading || getOntologyTreeLoading || getStudyFieldsLoading) {
        return <LoadSpinner />;
    }

    if (getProjectError || getOntologyTreeError || getStudyFieldsError) {
        return <div className={`${css.tab_page_wrapper} ${css.both_panel} ${css.upload_overlay}`}>
            A error occured, please contact your administrator
        </div>;
    }


    const headers = getStudyFieldsData.getStudyFields.map((el) => {
        return {
            label: el.fieldName,
            key: el.fieldId.toString()
        };
    });
    headers.push({ label: 'm_subjectId', key: 'm_subjectId' });
    headers.push({ label: 'm_visitId', key: 'm_visitId' });

    return <div className={css.tab_page_wrapper}>
        <Button type='primary' htmlType='submit' onClick={() => setIsDataSelectorShown(true)}>
            Select Data
        </Button>
        <Switch checkedChildren='Data Mode' unCheckedChildren='Visual Mode' checked={viewMode} onChange={() => setViewMode(!viewMode)} />
        <br /><br /><br />
        <Modal
            width='80%'
            visible={isDataSelectorShown}
            title='Data Selector'
            onOk={() => setIsDataSelectorShown(false)}
            onCancel={() => setIsDataSelectorShown(false)}
        >
            <div style={{ width: '100%', display: 'flex' }}>
                <Subsection title='Fields & Variables'>
                    <FieldListSelectionStateProject ontologyTree={getOntologyTreeData.getOntologyTree} fields={getProjectData.getProject.fields} checkedFields={checkedFields} onCheck={setCheckedFields} queryOptions={[queryOptions, setQueryOptions]} />
                </Subsection>
                <div style={{ width: '50%', marginLeft: 'auto' }}>
                    <Subsection title='Filters'>
                        {queryOptions.filters.length === 0 ? <p>No filters added.</p> :
                            <Table
                                rowKey={(rec) => rec.name.toString().concat(rec.op.toString()).concat(rec.value.toString())}
                                columns={[
                                    {
                                        title: 'Field Name',
                                        dataIndex: 'name',
                                        key: 'name',
                                        sorter: (a, b) => a.name.localeCompare(b.name),
                                        render: (__unused__value, record) => {
                                            return record.name;
                                        }
                                    },
                                    {
                                        title: 'Operator',
                                        dataIndex: 'op',
                                        key: 'op',
                                        render: (__unused__value, record) => {
                                            return record.op;
                                        }
                                    },
                                    {
                                        title: 'Value',
                                        dataIndex: 'value',
                                        key: 'value',
                                        render: (__unused__value, record) => {
                                            return record.value;
                                        }
                                    },
                                    {
                                        render: (__unused__value, record) => (
                                            <Button icon={<DeleteOutlined />} onClick={() => {
                                                setQueryOptions({
                                                    ...queryOptions,
                                                    filters: queryOptions.filters.filter((el) => {
                                                        if (el.field === record.field && el.op === record.op && el.value === record.value) {
                                                            return false;
                                                        }
                                                        return true;
                                                    })
                                                });
                                            }} >
                                                Delete
                                            </Button>
                                        ),
                                        width: '8rem',
                                        key: 'delete'
                                    }
                                ]}
                                dataSource={queryOptions.filters}
                                size='small'
                                pagination={false}
                            >
                            </Table>
                        }
                    </Subsection>
                </div>
            </div>
        </Modal>
        <Query<any, any> query={GET_DATA_RECORDS} variables={{ studyId: studyId, projectId: projectId, queryString: constructQueryString(checkedFields.filter((el) => el.indexOf('CAT') === -1), getProjectData.getProject.fields, queryOptions['filters'], queryOptions['derivedFields']) }} >
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
                        fieldKeysInQueryResult = { ...fieldKeysInQueryResult, ...queryResult[subject][visit] };
                        dataInArray.push(queryResult[subject][visit]);
                    }
                }
                if (viewMode) {
                    for (const key in fieldKeysInQueryResult) {
                        let fieldName = '';
                        for (let i = 0; i < fieldsList.length; i++) {
                            if (key.toString() === fieldsList[i].fieldId.toString()) {
                                fieldName = fieldsList[i].fieldName;
                            }
                        }
                        const name = fieldName === '' ? key : fieldName;
                        if (['Demographics', 'Medical History', 'Concomitant Medications'].includes(name)) {
                            continue;
                        }
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
                                        defaultCurrent: 1,
                                        showQuickJumper: true
                                    }
                                }
                                columns={columns}
                                dataSource={dataInArray.filter(el => el.m_visitId !== '0')}
                                size='middle'
                            ></Table>
                        </SubsectionWithComment><br />
                    </>;
                } else {
                    // processing numberical data
                    const fieldKeysInQueryResult = Object.keys(dataInArray.reduce(function (result, obj) {
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
                    const uniqueVisitIds = Array.from(new Set(dataInArray.map(el => el.m_visitId)));
                    const uniqueSubjectIds = Array.from(new Set(dataInArray.map(el => el.m_subjectId)));
                    const numbericalData: any = {};
                    idsOfNumbericalFields.forEach(element => {
                        numbericalData[element['fieldId']] = [];
                        uniqueVisitIds.forEach(elementIn => {
                            numbericalData[element['fieldId']].push({
                                name: elementIn
                            });
                        });
                    });
                    dataInArray.forEach(element => {
                        idsOfNumbericalFields.forEach(eleField => {
                            if (element[eleField['fieldId']] !== undefined && element[eleField['fieldId']] !== null) {
                                numbericalData[eleField['fieldId']][numbericalData[eleField['fieldId']].map(el => el.name).indexOf(element['m_visitId'])][element['m_subjectId']] = element[eleField['fieldId']];
                            }
                        });
                    });

                    // processing categorical data, shown as percentage
                    const idsOfCategoricalFields = getStudyFieldsData.getStudyFields.filter((el) => {
                        if (fieldKeysInQueryResult.filter((es) => es.toString() === el.fieldId).length === 0) {
                            return false;
                        }
                        if (el.dataType !== enumValueType.BOOLEAN && el.dataType !== enumValueType.CATEGORICAL) {
                            return false;
                        }
                        return true;
                    });
                    const categoricalData: any = {};
                    idsOfCategoricalFields.forEach(element => {
                        categoricalData[element['fieldId']] = [];
                        uniqueVisitIds.forEach(elementIn => {
                            if (element.dataType === enumValueType.BOOLEAN) {
                                categoricalData[element['fieldId']].push({
                                    name: elementIn,
                                    True: 0,
                                    False: 0
                                });
                            } else {
                                categoricalData[element['fieldId']].push({
                                    name: elementIn,
                                    ...element.possibleValues.reduce((acc, curr) => {
                                        acc[curr.code] = 0;
                                        return acc;
                                    }, {})
                                });
                            }
                        });
                    });
                    for (const fieldId in categoricalData) {
                        for (let i = 0; i < uniqueVisitIds.length; i++) {
                            for (const cat in categoricalData[fieldId][i]) {
                                if (cat === 'name') {
                                    continue;
                                } else {
                                    categoricalData[fieldId][i][cat] = dataInArray.filter(el => el.m_visitId === uniqueVisitIds[i] && el[fieldId] === cat).length /
                                        dataInArray.filter(el => el.m_visitId === uniqueVisitIds[i]).length;
                                }
                            }
                        }
                    }
                    return <>
                        <Subsection title='Numerical Data'>
                            {
                                Object.keys(numbericalData).map(el =>
                                    <>
                                        <LineChart width={730} height={250} data={numbericalData[el]}
                                            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                            <CartesianGrid strokeDasharray='3 3' />
                                            <XAxis dataKey='name' label={idsOfNumbericalFields.filter(es => es.fieldId === el)[0].fieldName} />
                                            <YAxis domain={['auto', 'auto']} label={idsOfNumbericalFields.filter(es => es.fieldId === el)[0].unit} />
                                            <Tooltip />
                                            <Legend />
                                            {
                                                uniqueSubjectIds.map(es => <Line type='monotone' dataKey={es} stroke={randomStringToColor(es)} />)
                                            }
                                        </LineChart>
                                        <br /><br />
                                    </>
                                )
                            }
                        </Subsection>
                        <Subsection title='Categorical Data'>
                            {
                                Object.keys(categoricalData).map(el =>
                                    <>
                                        <BarChart width={730} height={250} data={numbericalData[el]}
                                            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                            <CartesianGrid strokeDasharray='3 3' />
                                            <XAxis />
                                            <YAxis />
                                            <Tooltip />
                                            <Legend />
                                            {
                                                Object.keys(el).map(es => {
                                                    if (es === 'name') {
                                                        return null;
                                                    } else {
                                                        return <Bar dataKey={es} >
                                                            <LabelList dataKey={es} />
                                                        </Bar>;
                                                    }
                                                })
                                            }
                                        </BarChart>
                                    </>
                                )
                            }
                        </Subsection>
                    </>;
                }
            }}
        </Query>
    </div>;
};

const FieldListSelectionStateProject: React.FunctionComponent<{ ontologyTree: any, fields: IFieldEntry[], checkedFields: any, onCheck: any, queryOptions: any }> = ({ ontologyTree, fields, checkedFields, onCheck, queryOptions }) => {
    /* PRECONDITION: it is given (checked by parent component that fields at least have one key */
    return <FieldListSectionWithFilter ontologyTree={ontologyTree} checkable={true} fieldList={fields} onCheck={onCheck} checkedList={checkedFields} queryOptions={queryOptions} />;
};

function constructQueryString(checkedList: any, fieldsList: any, filters: any, derivedFields: any) {
    const queryString: any = {};
    // returned Fields
    // const returnedFields = []
    const returnedFields: any[] = [];
    for (let i = 0; i < checkedList.length; i++) {
        for (let j = 0; j < fieldsList.length; j++) {
            if (checkedList[i] === fieldsList[j].id) {
                returnedFields.push(fieldsList[j].fieldId);
            }
        }
    }
    returnedFields.push('m_subjectId');
    returnedFields.push('m_visitId');
    // cohort
    const cohort: any[] = [];
    for (let i = 0; i < filters.length; i++) {
        for (let j = 0; j < fieldsList.length; j++) {
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

function randomStringToColor(str: string) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    let colour = '#';
    for (let i = 0; i < 3; i++) {
        const value = (hash >> (i * 8)) & 0xFF;
        colour += ('00' + value.toString(16)).substr(-2);
    }
    return colour;
}
