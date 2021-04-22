import * as React from 'react';
import { Query } from '@apollo/client/react/components';
import { useQuery, useMutation } from '@apollo/client/react/hooks';
import { GET_PROJECT, GET_STUDY, IFieldEntry, CREATE_QUERY, CREATE_QUERY_CURATION_JOB, WHO_AM_I, GET_QUERY_BY_ID } from 'itmat-commons';
import { FieldListSectionWithFilter } from '../../../reusable/fieldList/fieldList';
import LoadSpinner from '../../../reusable/loadSpinner';
import { Subsection, SubsectionWithComment } from '../../../reusable/subsection/subsection';
import css from './tabContent.module.css';
import { List, Card, Button, Table } from 'antd';

export const DataTabContent: React.FunctionComponent<{ studyId: string; projectId: string }> = ({ studyId, projectId }) => {
    const { loading: getStudyLoading, error: getStudyError, data: getStudyData } = useQuery(GET_STUDY, { variables: { studyId: studyId } });
    const { loading: getProjectLoading, error: getProjectError, data: getProjectData } = useQuery(GET_PROJECT, { variables: { projectId: projectId, admin: false } });
    const { loading: whoAmILoading, error: whoAmIError, data: whoAmIData } = useQuery(WHO_AM_I);

    const [checkedFields, setCheckedFields] = React.useState<any[]>([]);
    const [queryOptions, setQueryOptions] = React.useState<any>({filters: [], returned_fields: [], derivedFields: []});
    const [queryId, setQueryId] = React.useState('');
    // const [queryData, setQueryData] = React.useState<any>({});

    const [selectedTree, setSelectedTree] = React.useState(Object.keys(getProjectData.getProject.fields)[0]);
    console.log(queryId);
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
            setQueryId(queryId);
            createQueryCurationJob({variables: {
                queryId: queryId,
                studyId: studyId,
                projectId: projectId,
                dataVersionId: getStudyData.getStudy.dataVersions[getStudyData.getStudy.currentDataVersion].version
            }});
        }
    });

    if (getStudyLoading || getProjectLoading || whoAmILoading) {
        return <LoadSpinner />;
    }

    if (getStudyError || getProjectError || whoAmIError) {
        return <div className={`${css.tab_page_wrapper} ${css.both_panel} ${css.upload_overlay}`}>
            A error occured, please contact your administrator
        </div>;
    }

    if (Object.keys(getProjectData.getProject.fields).length === 0) { return <p>No fields uploaded or available to you. If this should not be the case, check your permission with admin.</p>; }

    return <div className={css.scaffold_wrapper}>
        <div className={css.tab_page_wrapper + ' ' + css.left_panel}>
            <Subsection title='Fileds & Variables'>
                <FieldListSelectionStateProject fields={getProjectData.getProject.fields.map(el => el.fieldsInFieldTree)} studyData={getStudyData} checkedFields={checkedFields} onCheck={setCheckedFields} queryOptions={[queryOptions, setQueryOptions]} setTopSelectedTree={setSelectedTree}/>
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
            <Button type='primary' htmlType='submit' onClick={() => {
                createQuery({variables: {query: {queryString: JSON.stringify(constructQueryString(checkedFields.filter((el) => el.indexOf('CAT') === -1), getProjectData.getProject.fields[selectedTree].fieldsInFieldTree, queryOptions['filters'], queryOptions['derivedFields'])), studyId: studyId, projectId: projectId, userId: whoAmIData.whoAmI.id}}});
            }}>
                        Fetch Data
            </Button>
        </div>
        <div className={css.tab_page_wrapper + ' ' + css.right_panel}>
            <Query<any, any> query={GET_QUERY_BY_ID} variables={{ queryId: queryId }}>
                {({ data, loading, error, refetch }) => {
                    if (queryId !== '') {
                        if (error || !data || data.getQueryById.queryResult === null) {
                            setTimeout(() => {
                                refetch();
                            }, (5000));
                        } else {
                            console.log('cleared');
                        }
                    }
                    if (loading) { return <LoadSpinner />; }
                    if (error) { return <p>No results found.</p>; }
                    if (!data || data.getQueryById.queryResult === null) { return <p>Not available.</p>; }
                    const columns: any[] = [];
                    let unit = '';
                    const fieldsList = getProjectData.getProject.fields[selectedTree].fieldsInFieldTree;
                    const queryResult = JSON.parse(data.getQueryById.queryResult);
                    const fieldKeysInQueryResult = Object.keys(queryResult.reduce(function(result, obj) {
                        return Object.assign(result, obj);
                    }, {}));
                    for (const key of fieldKeysInQueryResult) {
                        let fieldName = '';
                        unit = '';
                        for (let i=0; i<fieldsList.length; i++) {
                            if (key.toString() === fieldsList[i].fieldId.toString()) {
                                fieldName = fieldsList[i].fieldName;
                                unit = fieldsList[i].unit;
                            }
                        }
                        if (key === 'm_eid') {
                            // fieldName = 'm_eid';
                            continue;
                        }
                        const name = fieldName === '' ? key : fieldName;
                        columns.push({
                            title: unit === '' ? name : (name.concat(' (').concat(unit).concat(')')),
                            dataIndex: key,
                            key: key,
                            render: (__unused__value, record) => {
                                if (!(key in record)) {
                                    return 'NR';
                                }
                                if (Object.keys(fieldsList).map((el) => fieldsList[el].fieldId.toString()).includes(key)) {
                                    return record[key]['1']['1'];
                                } else {
                                    return record[key];
                                }
                            }
                        });
                    }
                    console.log(columns);
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
                        </SubsectionWithComment>
                    </>;
                }}
            </Query>

        </div>
    </div>;
};

const FieldListSelectionStateProject: React.FunctionComponent<{ fields: { [fieldTreeId: string]: IFieldEntry[] }, studyData: any, checkedFields: any, onCheck: any, queryOptions: any, setTopSelectedTree: any }> = ({ fields, studyData, checkedFields,onCheck, queryOptions, setTopSelectedTree }) => {
    /* PRECONDITION: it is given (checked by parent component that fields at least have one key */
    const [selectedTree, setSelectedTree] = React.useState(Object.keys(fields)[0]);
    return <>
        <label>Select field tree: </label><select onChange={(e) => {setSelectedTree(e.target.value); setTopSelectedTree(e.target.value);}} value={selectedTree}>{Object.keys(fields).map((el) => <option key={el} value={el}>{el}</option>)}</select><br /><br />
        <FieldListSectionWithFilter checkable={true} fieldList={fields[selectedTree]} onCheck={onCheck} checkedList={checkedFields} studyData={studyData.getStudy} queryOptions={queryOptions} />
    </>;

};

function constructQueryString(checkedList: any, fieldsList: any, filters: any, derivedFields: any) {
    const queryString: any = {};
    // returned Fields
    // const returnedFields = []
    const returnedFields: any[] = [];
    for (let i=0; i<checkedList.length; i++) {
        for (let j=0; j<fieldsList.length; j++) {
            if (checkedList[i] === fieldsList[j].id) {
                returnedFields.push(fieldsList[j].fieldId.toString().concat('.1.1'));
            }
        }
    }
    // cohort
    const cohort: any[] = [];
    for (let i=0; i<filters.length; i++) {
        for (let j=0; j<fieldsList.length; j++) {
            if (fieldsList[j].id === filters[i].field) {
                cohort.push({
                    field: fieldsList[j].fieldId.toString().concat('.1.1'),
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
