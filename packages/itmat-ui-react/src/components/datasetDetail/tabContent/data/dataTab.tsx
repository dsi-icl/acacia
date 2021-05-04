import 'antd/lib/switch/style/css';
import * as React from 'react';
import { useQuery, useMutation } from '@apollo/client/react/hooks';
import { GET_STUDY, GET_STUDY_FIELDS, GET_DATA_RECORDS, CREATE_NEW_DATA_VERSION, SET_DATAVERSION_AS_CURRENT, IStudyDataVersion } from 'itmat-commons';
import { InfoCircleOutlined } from '@ant-design/icons';
import LoadSpinner from '../../../reusable/loadSpinner';
import { Subsection } from '../../../reusable/subsection/subsection';
import { DataSummaryVisual } from './dataSummary';
import { FieldListSection } from '../../../reusable/fieldList/fieldList';
import css from './tabContent.module.css';
import { UploadNewData } from './uploadNewData';
import { UploadNewFields } from './uploadNewFields';
import { Select, Button, Form, Input, Switch } from 'antd';
const { Option } = Select;

export const DataManagementTabContentFetch: React.FunctionComponent<{ studyId: string }> = ({ studyId }) => {
    const { loading: getStudyLoading, error: getStudyError, data: getStudyData } = useQuery(GET_STUDY, { variables: { studyId: studyId } });
    const { loading: getStudyFieldsLoading, error: getStudyFieldsError, data: getStudyFieldsData } = useQuery(GET_STUDY_FIELDS, { variables: { studyId: studyId } });
    const { loading: getDataRecordsLoading, error: getDataRecordsError, data: getDataRecordsData } = useQuery(GET_DATA_RECORDS, { variables: { studyId: studyId, versionId: [null] } });
    const [createNewDataVersion] = useMutation(CREATE_NEW_DATA_VERSION);
    const [setDataVersion, { loading }] = useMutation(SET_DATAVERSION_AS_CURRENT);

    const [selectedVersion, setSelectedVersion] = React.useState(getStudyData.getStudy.currentDataVersion);
    const [selectedFieldTreeId, setSelectedFieldTreeId] = React.useState('');
    const [selectedFieldTreeIdForDataUpload, setSelectedFieldTreeIdForDataUpload] = React.useState<string>('');
    const [useLinearHistory, setUseLinearHistory] = React.useState(false);

    if (getStudyLoading || getStudyFieldsLoading || getDataRecordsLoading) {
        return <LoadSpinner />;
    }
    if (getStudyError) {
        return <p>
            A error occured, please contact your administrator: {(getStudyError as any).message || ''}, {(getStudyFieldsError as any).message || ''}, {(getDataRecordsError as any).message || ''}
        </p>;
    }

    const currentVersionContent = getStudyData.getStudy.dataVersions[getStudyData.getStudy.currentDataVersion]?.contentId;
    const showSaveVersionButton = true;
    const uniqueFieldTreeIds: string[] = Array.from(new Set(getStudyFieldsData.getStudyFields.map(el => el.fieldTreeId)));
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
            </div> : null }
        <div className={css.tab_page_wrapper + ' ' + css.left_panel}>
            <Subsection title='Upload New Fields'>
                <UploadNewFields studyId={studyId} />
            </Subsection><br/>
            <Subsection title='Fields & Variables'>
                {console.log(uniqueFieldTreeIds)}
                <Select
                    placeholder='Select Field'
                    allowClear
                    onChange={(value) => {
                        console.log(value);
                        setSelectedFieldTreeId(value.toString());
                    }}
                    style={{width: '80%'}}
                >
                    {uniqueFieldTreeIds.map((el) => <Option value={el} >{el}</Option>)}
                </Select>
                <FieldListSection
                    studyData={getStudyData.getStudy}
                    onCheck={false}
                    checkable={false}
                    fieldList={getStudyFieldsData.getStudyFields.filter(el => el.fieldTreeId === selectedFieldTreeId)}
                ></FieldListSection>
                <br /><br />

            </Subsection>
        </div>

        <div className={css.tab_page_wrapper + ' ' + css.right_panel}>
            <Subsection title='Upload New Data'>
                <Select
                    placeholder='Select Field'
                    allowClear
                    onChange={(value) => {
                        console.log(value);
                        setSelectedFieldTreeIdForDataUpload(value.toString());
                    }}
                    style={{width: '80%'}}
                >
                    {uniqueFieldTreeIds.map((el) => <Option value={el} >{el}</Option>)}
                </Select>
                <UploadNewData studyId={studyId} fieldTreeId={selectedFieldTreeIdForDataUpload} cancelButton={() => { return; }} ></UploadNewData>
            </Subsection><br/>
            <Subsection title='Unsettled Data'>
                {JSON.parse(getDataRecordsData.getDataRecords).data.length !== 0 ?
                    <div>
                        <p>Number Of Records: {JSON.parse(getDataRecordsData.getDataRecords).data.length}</p>
                        <Form onFinish={(variables) => {
                            console.log(variables);
                            createNewDataVersion({
                                variables: {
                                    ...variables,
                                    studyId: studyId
                                }
                            });}}>
                            <Form.Item name='fieldTreeId' hasFeedback rules={[{ required: true, message: ' ' }]}>
                                <Select
                                    placeholder='Select Field'
                                    allowClear
                                    style={{width: '80%'}}
                                >
                                    {uniqueFieldTreeIds.map((el) => <Option value={el} >{el}</Option>)}
                                </Select>
                            </Form.Item>
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
                    </div> :
                    <p>No unsettled data found.</p>}
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
