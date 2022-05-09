import 'antd/lib/switch/style/css';
import * as React from 'react';
import { useQuery, useMutation } from '@apollo/client/react/hooks';
import { Query } from '@apollo/client/react/components';
import { GET_STUDY, GET_STUDY_FIELDS, GET_DATA_RECORDS, CREATE_NEW_DATA_VERSION, SET_DATAVERSION_AS_CURRENT, IStudyDataVersion, WHO_AM_I, userTypes } from 'itmat-commons';
import { InfoCircleOutlined } from '@ant-design/icons';
import LoadSpinner from '../../../reusable/loadSpinner';
import { Subsection } from '../../../reusable/subsection/subsection';
import { DataSummaryVisual } from './dataSummary';
import { FieldListSection } from '../../../reusable/fieldList/fieldList';
import css from './tabContent.module.css';
// import { UploadNewData } from './uploadNewData';
// import { UploadNewFields } from './uploadNewFields';
import { Button, Form, Input, Switch, Modal, Table } from 'antd';
import { useParams } from 'react-router-dom';

export const DataManagementTabContentFetch: React.FunctionComponent = () => {
    const { studyId } = useParams();
    const { loading: getStudyLoading, error: getStudyError, data: getStudyData } = useQuery(GET_STUDY, { variables: { studyId: studyId } });
    const { loading: getStudyFieldsLoading, error: getStudyFieldsError, data: getStudyFieldsData } = useQuery(GET_STUDY_FIELDS, { variables: { studyId: studyId } });
    const { loading: getDataRecordsLoading, error: getDataRecordsError, data: getDataRecordsData } = useQuery(GET_DATA_RECORDS, {
        variables: {
            studyId: studyId, versionId: null, queryString: {
                data_requested: null,
                new_fields: null,
                cohort: null
            }
        }
    });
    const { loading: whoAmILoading, error: whoAmIError, data: whoAmIData } = useQuery(WHO_AM_I);
    const [createNewDataVersion] = useMutation(CREATE_NEW_DATA_VERSION);
    const [setDataVersion, { loading }] = useMutation(SET_DATAVERSION_AS_CURRENT);

    const [selectedVersion, setSelectedVersion] = React.useState(getStudyData.getStudy.currentDataVersion);
    const [useLinearHistory, setUseLinearHistory] = React.useState(false);
    const [isModalOn, setIsModalOn] = React.useState(false);
    if (getStudyLoading || getStudyFieldsLoading || getDataRecordsLoading || whoAmILoading) {
        return <LoadSpinner />;
    }
    if (!studyId || getStudyError || getStudyFieldsError || getDataRecordsError || whoAmIError) {
        return <p>
            A error occured, please contact your administrator
        </p>;
    }
    const currentVersionContent = getStudyData.getStudy.dataVersions[getStudyData.getStudy.currentDataVersion]?.contentId;
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

    return <div className={css.data_management_section}>
        {getStudyData.getStudy.currentDataVersion !== -1 ?
            <div className={css.top_panel}>
                {getStudyData.getStudy.dataVersions.length >= 1 ? <>
                    <div><h5>Data versions</h5>  <h5>Linear history<InfoCircleOutlined className={css.infocircle} />:  <Switch onChange={(checked) => setUseLinearHistory(checked)} checked={useLinearHistory} className={css.switchButton} /></h5></div>

                    {
                        useLinearHistory ?
                            (
                                getStudyData.getStudy.dataVersions.map((el, ind) =>
                                    <React.Fragment key={el.id}>
                                        <div
                                            key={el.id}
                                            onClick={() => { setSelectedVersion(ind); }}
                                            className={css.data_version_cube + (ind === selectedVersion ? (ind === getStudyData.getStudy.currentDataVersion ? ` ${css.data_version_cube_current}` : ` ${css.data_version_cube_selected_not_current}`) : '')}>{`${el.version}${el.tag ? ` (${el.tag})` : ''}`}
                                        </div>
                                        {ind === getStudyData.getStudy.dataVersions.length - 1 ? null : <span className={css.arrow}>⟶</span>}
                                    </React.Fragment>
                                )
                            )
                            :
                            (
                                removeDuplicateVersion(getStudyData.getStudy.dataVersions).map((el, ind) => <React.Fragment key={el.id}>
                                    <div
                                        key={el.id}
                                        onClick={() => { setSelectedVersion(el.originalPosition); }}
                                        className={css.data_version_cube + (el.originalPosition === selectedVersion ? (el.contentId === currentVersionContent ? ` ${css.data_version_cube_current}` : ` ${css.data_version_cube_selected_not_current}`) : '')}>{`${el.version}${el.tag ? ` (${el.tag})` : ''}`}
                                    </div>
                                    {ind === removeDuplicateVersion(getStudyData.getStudy.dataVersions).length - 1 ? null : <span className={css.arrow}>⟶</span>}
                                </React.Fragment>)
                            )
                    }

                    {showSaveVersionButton && (selectedVersion !== getStudyData.getStudy.currentDataVersion) ?
                        <Button key='save version' onClick={() => { if (loading) { return; } setDataVersion({ variables: { studyId: getStudyData.getStudy.id, dataVersionId: getStudyData.getStudy.dataVersions[selectedVersion].id } }); window.location.reload(); }} className={css.versioning_section_button}>{loading ? 'Loading...' : 'Set as current version'}</Button>
                        : null
                    }<br />
                </> : null}
            </div> : null}
        <div className={css.tab_page_wrapper + ' ' + css.left_panel}>
            {/* <Subsection title='Upload New Fields'>
                <UploadNewFields studyId={studyId} />
            </Subsection><br /> */}
            <Subsection title='Fields & Variables'>
                <FieldListSection
                    studyData={getStudyData.getStudy}
                    onCheck={false}
                    checkable={false}
                    fieldList={getStudyFieldsData.getStudyFields}
                ></FieldListSection>
                <br /><br />

            </Subsection>
        </div>

        <div className={css.tab_page_wrapper + ' ' + css.right_panel}>
            {/* <Subsection title='Upload New Data'>
                <UploadNewData studyId={studyId} ></UploadNewData>
            </Subsection><br /> */}
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
                {whoAmIData.whoAmI.type === userTypes.ADMIN ?
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
                    </Form> : null}
            </Subsection>
            <Subsection title='Data Summary'>
                <DataSummaryVisual
                    studyId={studyId}
                    selectedVersion={getStudyData.getStudy.currentDataVersion}
                    currentVersion={getStudyData.getStudy.currentDataVersion}
                    versions={getStudyData.getStudy.dataVersions}
                    key={studyId}
                />
            </Subsection>
        </div>
    </div>;
};

function removeDuplicateVersion(versions: IStudyDataVersion[]) {
    const alreadySeenContent: string[] = [];
    const uniqueContent: any[] = [];
    const tmp = [...versions].reverse();
    tmp.forEach((el, ind) => {
        if (alreadySeenContent.includes(el.contentId)) {
            return;
        } else {
            alreadySeenContent.push(el.contentId);
            uniqueContent.push({ ...el, originalPosition: tmp.length - ind - 1 });
        }
    });
    return uniqueContent.reverse();
}
