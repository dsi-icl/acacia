import { Fragment, FunctionComponent, useState } from 'react';
import { generateCascader } from '../../../../utils/tools';
import { useQuery, useMutation } from '@apollo/client/react/hooks';
import { Query } from '@apollo/client/react/components';
import { GET_STUDY, GET_STUDY_FIELDS, GET_DATA_RECORDS, CREATE_NEW_DATA_VERSION, SET_DATAVERSION_AS_CURRENT, WHO_AM_I, GET_ONTOLOGY_TREE } from '@itmat-broker/itmat-models';
import { userTypes, IOntologyRoute } from '@itmat-broker/itmat-types';
import LoadSpinner from '../../../reusable/loadSpinner';
import { Subsection, SubsectionWithComment } from '../../../reusable/subsection/subsection';
import { DataSummaryVisual } from './dataSummary';
import { FieldListSection } from '../../../reusable/fieldList/fieldList';
import css from './tabContent.module.css';
import { Button, Form, Input, Modal, Table, Tooltip, Select, Cascader } from 'antd';
import { useParams } from 'react-router-dom';
const { Option } = Select;

export const DataManagementTabContentFetch: FunctionComponent = () => {
    const { studyId } = useParams();
    const { loading: getStudyLoading, error: getStudyError, data: getStudyData } = useQuery(GET_STUDY, { variables: { studyId: studyId } });
    const { loading: getStudyFieldsLoading, error: getStudyFieldsError, data: getStudyFieldsData } = useQuery(GET_STUDY_FIELDS, { variables: { studyId: studyId } });
    const { loading: getDataRecordsLoading, error: getDataRecordsError, data: getDataRecordsData } = useQuery(GET_DATA_RECORDS, {
        variables: {
            studyId: studyId, versionId: null, queryString: {
                data_requested: null,
                new_fields: null,
                cohort: null,
                format: 'raw'
            }
        }
    });
    const { loading: getOntologyTreeLoading, error: getOntologyTreeError, data: getOntologyTreeData } = useQuery(GET_ONTOLOGY_TREE, {
        variables: {
            studyId: studyId,
            treeId: null
        }
    });
    const { loading: whoAmILoading, error: whoAmIError, data: whoAmIData } = useQuery(WHO_AM_I);
    const [createNewDataVersion] = useMutation(CREATE_NEW_DATA_VERSION);
    const [setDataVersion, { loading }] = useMutation(SET_DATAVERSION_AS_CURRENT);
    const [selectedPath, setSelectedPath] = useState<any[]>([]);
    const [selectedVersion, setSelectedVersion] = useState(getStudyData.getStudy.currentDataVersion);
    const [isModalOn, setIsModalOn] = useState(false);
    const [treeId, setTreeId] = useState<string>('');
    if (getStudyLoading || getStudyFieldsLoading || getDataRecordsLoading || whoAmILoading || getOntologyTreeLoading) {
        return <LoadSpinner />;
    }
    if (!studyId || getStudyError || getStudyFieldsError || getDataRecordsError || whoAmIError || getOntologyTreeError) {
        return <p>
            An error occured, please contact your administrator
        </p>;
    }
    const showSaveVersionButton = true;
    // build the table columns for unversioned data
    const columns = [
        {
            title: 'Subject ID',
            dataIndex: 'subjectId',
            key: 'subjectId',
            render: (__unused__value, record) => {
                return record.subjectId;
            }
        },
        {
            title: 'Visit ID',
            dataIndex: 'visitId',
            key: 'visitId',
            render: (__unused__value, record) => {
                return record.visitId.join('\t');
            }
        }
    ];

    const versions: any = [];
    for (const item of getStudyData.getStudy.dataVersions) {
        versions[item['version']] = item['id'];
    }

    //construct the cascader
    const fieldPathOptions: any = [];
    getOntologyTreeData.getOntologyTree.filter(el => el.id === treeId)[0]?.routes.forEach(el => {
        generateCascader(el, fieldPathOptions, false);
    });
    const routes: IOntologyRoute[] = getOntologyTreeData.getOntologyTree.filter(es => es.id === treeId)[0]?.routes?.filter(es => {
        return JSON.stringify(es.path) === JSON.stringify(selectedPath);
    }) || [];
    const fields: string[] = routes.length !== 0 ? routes.map(es => JSON.stringify(es.field)) : [];

    return <div className={css.data_management_section}>
        {getStudyData.getStudy.currentDataVersion !== -1 ?
            <div className={css.top_panel}>
                {getStudyData.getStudy.dataVersions.length >= 1 ? <>
                    {
                        getStudyData.getStudy.dataVersions.map((el, ind) =>
                            <Fragment key={el.id}>
                                <div
                                    key={el.id}
                                    onClick={() => { setSelectedVersion(ind); }}
                                    className={css.data_version_cube + (ind === selectedVersion ? (ind === getStudyData.getStudy.currentDataVersion ? ` ${css.data_version_cube_current}` : ` ${css.data_version_cube_selected_not_current}`) : '')}>
                                    {<Tooltip title={el.tag || ''}>
                                        <span>{el.version}</span>
                                    </Tooltip>}
                                </div>
                                {ind === getStudyData.getStudy.dataVersions.length - 1 ? null : <span className={css.arrow}>⟶</span>}
                            </Fragment>
                        )
                    }

                    {showSaveVersionButton && (selectedVersion !== getStudyData.getStudy.currentDataVersion) ?
                        <Button key='save version' onClick={() => { if (loading) { return; } setDataVersion({ variables: { studyId: getStudyData.getStudy.id, dataVersionId: getStudyData.getStudy.dataVersions[selectedVersion].id } }); window.location.reload(); }} className={css.versioning_section_button}>{loading ? 'Loading...' : 'Set as current version'}</Button>
                        : null
                    }<br />
                </> : null}
            </div> : null}
        <div className={css.tab_page_wrapper + ' ' + css.left_panel}>
            <SubsectionWithComment title='Fields & Variables' comment={
                <>
                    <Select
                        placeholder='Tree'
                        allowClear
                        onSelect={(value: string) => { setTreeId(value); }}
                        value={treeId}
                    >
                        {
                            getOntologyTreeData.getOntologyTree.map(el => <Option value={el.id}>{el.name}</Option>)
                        }
                    </Select>
                    <Cascader
                        options={fieldPathOptions}
                        onChange={(value) => setSelectedPath(value)}
                        placeholder={'Please select'}
                    />
                </>}>
                <FieldListSection
                    studyData={getStudyData.getStudy}
                    onCheck={false}
                    checkable={false}
                    fieldList={selectedPath.length === 0 ? [] : [...getStudyFieldsData.getStudyFields.filter(el => {
                        if (!routes) {
                            return false;
                        }
                        if (fields.includes(JSON.stringify(['$' + el.fieldId.toString()]))) {
                            return true;
                        }
                        return false;
                    })]}
                    verbal={true}
                ></FieldListSection>
                {/* <FieldListRadial
                    studyData={getStudyData.getStudy}
                    fieldList={getStudyFieldsData.getStudyFields}
                ></FieldListRadial> */}
                <br /><br />

            </SubsectionWithComment>
        </div>

        <div className={css.tab_page_wrapper + ' ' + css.right_panel}>
            {whoAmIData.whoAmI.type === userTypes.ADMIN ?
                <Subsection title='Create New Data Version'>
                    <Modal
                        width='80%'
                        visible={isModalOn}
                        title='Unversioned Data'
                        onOk={() => setIsModalOn(false)}
                        onCancel={() => setIsModalOn(false)}
                    >
                        <Query<any, any> query={GET_DATA_RECORDS} variables={{
                            studyId: studyId, versionId: null, queryString: {
                                data_requested: null,
                                new_fields: null,
                                cohort: null
                            }
                        }}>
                            {({ data, loading, error }) => {
                                if (loading) { return <LoadSpinner />; }
                                if (error) { return <p>{JSON.stringify(error)}</p>; }
                                if (!data) { return <p>Not executed.</p>; }
                                const parsedData = getDataRecordsData.getDataRecords.data;
                                const groupedData: any = {};
                                for (const key in parsedData) {
                                    if (!(key in groupedData)) {
                                        groupedData[key] = [];
                                    }
                                    groupedData[key].push(Object.keys(parsedData[key]));
                                }
                                return (<Table
                                    scroll={{ x: 'max-content' }}
                                    rowKey={(rec) => rec.id}
                                    pagination={false}
                                    columns={columns}
                                    dataSource={Object.keys(groupedData).map((el) => {
                                        return {
                                            id: el,
                                            subjectId: el,
                                            visitId: groupedData[el]
                                        };
                                    })}
                                    size='middle'
                                ></Table>);
                            }}
                        </Query>
                    </Modal>

                    <Form onFinish={(variables) => {
                        createNewDataVersion({
                            variables: {
                                ...variables,
                                withUnversionedData: variables.withUnversionedData === 'true' ? true : false,
                                studyId: studyId
                            }
                        });
                    }}>
                        <Form.Item name='dataVersion' hasFeedback rules={[{ required: true, message: ' ' }]}>
                            <Input placeholder='Data Version' />
                        </Form.Item>
                        <Form.Item name='tag' hasFeedback rules={[{ required: true, message: ' ' }]}>
                            <Input placeholder='Tag' />
                        </Form.Item>
                        <Form.Item>
                            <Button type='primary' htmlType='submit'>
                                Submit
                            </Button>
                        </Form.Item>
                    </Form>
                </Subsection> : null}
            < Subsection title='Data Summary'>
                <DataSummaryVisual
                    studyId={studyId}
                    selectedVersion={getStudyData.getStudy.currentDataVersion}
                    currentVersion={getStudyData.getStudy.currentDataVersion}
                    versions={getStudyData.getStudy.dataVersions}
                    key={studyId}
                />
            </Subsection>
        </div>
    </div >;
};
