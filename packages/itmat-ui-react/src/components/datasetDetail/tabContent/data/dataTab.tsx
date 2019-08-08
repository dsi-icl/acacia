import { Models } from 'itmat-utils';
import * as React from 'react';
import { Query, Mutation } from 'react-apollo';
import { GET_PROJECT } from '../../../../graphql/projects';
import { CREATE_USER } from '../../../../graphql/appUsers';
import * as css from './tabContent.module.css';
import { NavLink, Redirect } from 'react-router-dom';
import { FieldListSection } from '../../../reusable/fieldList';
import { Subsection } from '../../../reusable/subsection';
import { LoadingBalls } from '../../../reusable/loadingBalls';
import { GET_STUDY } from '../../../../graphql/study';
import { UploadNewFields } from './uploadNewFields';
import { DataSummaryVisual } from './dataSummary';
import { UploadNewData } from './uploadNewData';
import { IStudy } from 'itmat-utils/dist/models/study';
import { FieldListSelectionSection } from './fieldListSelection';

export const DataManagementTabContent:React.FunctionComponent<{ studyId: string }> = ({ studyId }) => {
    return <div className={css.scaffold_wrapper}>
        <div>
        <Query query={GET_STUDY} variables={{ studyId }}>
            {({ loading, data, error }) => {
                if (loading) return <LoadingBalls/>;
                if (error) return <p>Error :( {JSON.stringify(error)}</p>; 
                if (data.getStudy && data.getStudy.currentDataVersion !== null && data.getStudy.currentDataVersion !== undefined && data.getStudy.dataVersions && data.getStudy.dataVersions[data.getStudy.currentDataVersion]) {
                    return <DataManagement data={data.getStudy} showSaveVersionButton/>;
                }
                return <p>There is no data uploaded for this study yet.</p>; 
            }}
        </Query>
        </div>
    </div>;
};


export const DataManagement: React.FunctionComponent<{ data: IStudy, showSaveVersionButton: boolean }> = ({ data, showSaveVersionButton }) => {
    const [selectedVersion, setSelectedVersion] = React.useState(data.currentDataVersion);
    const [addNewDataSectionShown, setAddNewDataSectionShown] = React.useState(false);

    return <>
        <div className={css.top_panel}>
            { data.dataVersions.length >= 2 ? <><h5>Data versions</h5>
                { data.dataVersions.map((el, ind) =>
                    <React.Fragment key={el.id}>
                        <div 
                            key={el.id}
                            onClick={() => { setSelectedVersion(ind); setAddNewDataSectionShown(false); } }
                            className={css.data_version_cube + ( ind === selectedVersion ? ( ind === data.currentDataVersion? ` ${css.data_version_cube_current}` : ` ${css.data_version_cube_selected_not_current}`) : '' )}>{`${el.version}${el.tag ? ` (${el.tag})` : ''}`}
                        </div>
                        {ind === data.dataVersions.length - 1 ? null : <span className={css.arrow}>⟶</span>}
                    </React.Fragment>
                )}
                <div key='new data' className={css.data_version_cube + ' ' + css.versioning_section_button} onClick={() => setAddNewDataSectionShown(true)}>Upload new data</div>
                { showSaveVersionButton && (selectedVersion !== data.currentDataVersion) ? 
                    <div key='save version' className={css.data_version_cube + ' ' + css.versioning_section_button} >Revert to this version</div>
                  : null 
                }<br/>
            </> : null }
            {
                addNewDataSectionShown ?
                <div className={css.add_new_fields_section}>
                    <UploadNewData studyId={data.id} cancelButton={setAddNewDataSectionShown}/>
                </div> :
                null
            }
        </div>

        <div className={css.tab_page_wrapper + ' ' + css.left_panel}>
            <Subsection title='Fields & Variables'>
                <FieldListSelectionSection
                    studyId={data.id}
                    selectedVersion={selectedVersion}
                    currentVersion={data.currentDataVersion}
                    versions={data.dataVersions}
                    key={data.id}
                />
                <UploadNewFields key={selectedVersion} dataVersionId={data.dataVersions[selectedVersion].id} studyId={data.id}/>
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