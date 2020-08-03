import { Switch } from 'antd';
import 'antd/lib/switch/style/css';
import * as React from 'react';
import { Query } from '@apollo/client/react/components';
import { useMutation } from '@apollo/client/react/hooks';
import { GET_STUDY, SET_DATAVERSION_AS_CURRENT, IStudy, IStudyDataVersion } from 'itmat-commons';
import { InfoCircle } from '../../../reusable/icons/infoCircle';
import { LoadingBalls } from '../../../reusable/icons/loadingBalls';
import { Subsection } from '../../../reusable/subsection/subsection';
import { DataSummaryVisual } from './dataSummary';
import { FieldListSelectionSection } from './fieldListSelection';
import css from './tabContent.module.css';
import { UploadNewData } from './uploadNewData';
import { UploadNewFields } from './uploadNewFields';



export const DataManagementTabContentFetch: React.FunctionComponent<{ studyId: string }> = ({ studyId }) => {
    return <div className={`${css.scaffold_wrapper} fade_in`}>
        <Query<any, any> query={GET_STUDY} variables={{ studyId }}>
            {({ loading, data, error }) => {
                if (loading) { return <LoadingBalls />; }
                if (error) { return <p>Error :( {JSON.stringify(error)}</p>; }
                if (data.getStudy && data.getStudy.currentDataVersion !== null && data.getStudy.currentDataVersion !== undefined && data.getStudy.dataVersions && data.getStudy.dataVersions[data.getStudy.currentDataVersion]) {
                    return <div className={css.data_management_section}><DataManagement data={data.getStudy} showSaveVersionButton /></div>;
                }
                return <div>
                    <p>There is no data uploaded for this study yet.</p>
                    <UploadNewData studyId={studyId} cancelButton={() => { return; }} />
                </div>;
            }}
        </Query>
    </div>;
};


export const DataManagement: React.FunctionComponent<{ data: IStudy; showSaveVersionButton: boolean }> = ({ data, showSaveVersionButton }) => {
    const [selectedVersion, setSelectedVersion] = React.useState(data.currentDataVersion);
    const [addNewDataSectionShown, setAddNewDataSectionShown] = React.useState(false);
    const [setDataVersion, { loading }] = useMutation(SET_DATAVERSION_AS_CURRENT);
    const [useLinearHistory, setUseLinearHistory] = React.useState(false);

    const currentVersionContent = data.dataVersions[data.currentDataVersion].contentId;

    return <>
        <div className={css.top_panel}>


            {data.dataVersions.length >= 1 ? <>
                <div><h5>Data versions</h5>  <h5>Linear history<InfoCircle className={css.infocircle} />:  <Switch onChange={(checked) => setUseLinearHistory(checked)} checked={useLinearHistory} className={css.switchButton} /></h5></div>

                {
                    useLinearHistory ?
                        (
                            data.dataVersions.map((el, ind) =>
                                <React.Fragment key={el.id}>
                                    <div
                                        key={el.id}
                                        onClick={() => { setSelectedVersion(ind); setAddNewDataSectionShown(false); }}
                                        className={css.data_version_cube + (ind === selectedVersion ? (ind === data.currentDataVersion ? ` ${css.data_version_cube_current}` : ` ${css.data_version_cube_selected_not_current}`) : '')}>{`${el.version}${el.tag ? ` (${el.tag})` : ''}`}
                                    </div>
                                    {ind === data.dataVersions.length - 1 ? null : <span className={css.arrow}>⟶</span>}
                                </React.Fragment>
                            )
                        )
                        :
                        (
                            removeDuplicateVersion(data.dataVersions).map((el, ind) => <React.Fragment key={el.id}>
                                <div
                                    key={el.id}
                                    onClick={() => { setSelectedVersion(el.originalPosition); setAddNewDataSectionShown(false); }}
                                    className={css.data_version_cube + (el.originalPosition === selectedVersion ? (el.contentId === currentVersionContent ? ` ${css.data_version_cube_current}` : ` ${css.data_version_cube_selected_not_current}`) : '')}>{`${el.version}${el.tag ? ` (${el.tag})` : ''}`}
                                </div>
                                {ind === removeDuplicateVersion(data.dataVersions).length - 1 ? null : <span className={css.arrow}>⟶</span>}
                            </React.Fragment>)
                        )
                }

                <button key='new data' className={css.versioning_section_button} onClick={() => setAddNewDataSectionShown(true)}>Upload new data</button>
                {showSaveVersionButton && (selectedVersion !== data.currentDataVersion) ?
                    <button key='save version' onClick={() => { if (loading) { return; } setDataVersion({ variables: { studyId: data.id, dataVersionId: data.dataVersions[selectedVersion].id } }); }} className={css.versioning_section_button}>{loading ? 'Loading...' : 'Set as current version'}</button>
                    : null
                }<br />
            </> : null}

            {
                addNewDataSectionShown ?
                    <div className={css.add_new_fields_section}>
                        <UploadNewData studyId={data.id} cancelButton={setAddNewDataSectionShown} />
                    </div> :
                    null
            }
        </div>

        <div className={css.tab_page_wrapper + ' ' + css.left_panel}>
            <Subsection title='Fields & Variables'>
                <UploadNewFields key={selectedVersion} dataVersionId={data.dataVersions[selectedVersion].id} studyId={data.id} />
                <br /><br />
                <FieldListSelectionSection
                    studyId={data.id}
                    selectedVersion={selectedVersion}
                    currentVersion={data.currentDataVersion}
                    versions={data.dataVersions}
                    key={data.id}
                />
            </Subsection>
        </div>

        <div className={css.tab_page_wrapper + ' ' + css.right_panel}>
            <Subsection title='Data'>
                <DataSummaryVisual
                    studyId={data.id}
                    selectedVersion={selectedVersion}
                    currentVersion={data.currentDataVersion}
                    versions={data.dataVersions}
                    key={data.id}
                />
            </Subsection>
        </div>

    </>;
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
