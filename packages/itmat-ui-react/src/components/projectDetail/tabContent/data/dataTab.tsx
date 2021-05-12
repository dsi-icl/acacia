import * as React from 'react';
import { Query } from '@apollo/client/react/components';
import { useQuery, useMutation } from '@apollo/client/react/hooks';
import { GET_PROJECT, IFieldEntry, CREATE_QUERY, CREATE_QUERY_CURATION_JOB, WHO_AM_I, GET_DATA_RECORDS, GET_QUERY, GET_QUERY_BY_ID, GET_STUDY_FIELDS, GET_ONTOLOGY_TREE } from 'itmat-commons';
import { FieldListSectionWithFilter } from '../../../reusable/fieldList/fieldList';
import LoadSpinner from '../../../reusable/loadSpinner';
import { Subsection, SubsectionWithComment } from '../../../reusable/subsection/subsection';
import css from './tabContent.module.css';
import { CSVLink } from 'react-csv';
import { List, Card, Button, Table, Modal } from 'antd';

export const DataTabContent: React.FunctionComponent<{ studyId: string; projectId: string }> = ({ studyId, projectId }) => {
    const { loading: getProjectLoading, error: getProjectError, data: getProjectData } = useQuery(GET_PROJECT, { variables: { projectId: projectId, admin: false } });
    const { loading: getQueryLoading, error: getQueryError, data: getQueryData } = useQuery(GET_QUERY, { variables: { projectId: projectId, studyId: studyId } });
    const { loading: whoAmILoading, error: whoAmIError, data: whoAmIData } = useQuery(WHO_AM_I);
    const { loading: getStudyFieldsLoading, error: getStudyFieldsError, data: getStudyFieldsData } = useQuery(GET_STUDY_FIELDS, { variables: { studyId: studyId, projectId: projectId } });
    const { loading: getOntologyTreeLoading, error: getOntologyTreeError, data: getOntologyTreeData } = useQuery(GET_ONTOLOGY_TREE, { variables: { studyId: studyId, projectId: projectId } });

    const [checkedFields, setCheckedFields] = React.useState<any[]>([]);
    const [queryOptions, setQueryOptions] = React.useState<any>({filters: [], returned_fields: [], derivedFields: []});

    const [isQueryResultShown, setIsQueryResultShown] = React.useState(false);
    const [viewQueryId, setViewQueryId] = React.useState('');


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
                console.log(uniqueFields);
                return (<CSVLink data={queryResult} headers={filteredHeaders}>
                    Download me
                </CSVLink>);
            }
        },
    ];

    return <div className={css.scaffold_wrapper}>
        <div className={css.tab_page_wrapper + ' ' + css.left_panel}>
            <Subsection title='Fileds & Variables'>
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
        </div>
        <div className={css.tab_page_wrapper + ' ' + css.right_panel}>
            <Subsection title='any'>
                <Query<any, any> query={GET_DATA_RECORDS} variables={{ studyId: studyId, projectId: projectId, queryString: JSON.stringify(constructQueryString(checkedFields.filter((el) => el.indexOf('CAT') === -1), getProjectData.getProject.fields, queryOptions['filters'], queryOptions['derivedFields'])) }}>
                    {({ data, loading, error }) => {
                        if (loading) { return <LoadSpinner />; }
                        if (error) { return <p>No results found.</p>; }
                        if (!data || data.getDataRecords === null) { return <p>Not available.</p>; }
                        console.log(data);

                        const columns: any[] = [];
                        const fieldsList = getProjectData.getProject.fields;
                        const queryResult = JSON.parse(data.getDataRecords).data;
                        const fieldKeysInQueryResult = Object.keys(queryResult.reduce(function(result, obj) {
                            return Object.assign(result, obj);
                        }, {}));

                        for (const key of fieldKeysInQueryResult) {
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
                            <SubsectionWithComment title='Visualization' comment={queryResult.length.toString().concat(' records found')} >
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
                                    dataSource={queryResult}
                                    size='middle'
                                ></Table>
                                <Button type='primary' htmlType='submit' onClick={() => {
                                    createQuery({variables: {query: {queryString: JSON.stringify(constructQueryString(checkedFields.filter((el) => el.indexOf('CAT') === -1), getProjectData.getProject.fields, queryOptions['filters'], queryOptions['derivedFields'])), studyId: studyId, projectId: projectId, userId: whoAmIData.whoAmI.id}}});
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
