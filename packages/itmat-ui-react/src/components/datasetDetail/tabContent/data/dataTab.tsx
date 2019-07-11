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
import { DataSummary } from './dataSummary';
import { UploadNewData } from './uploadNewData';
import { DataVersions } from './dataVersions';

export const DataManagementTabContent:React.FunctionComponent<{ studyId: string }> = ({ studyId }) => {
    return <div className={css.scaffold_wrapper}>
        <div className={css.tab_page_wrapper + ' ' + css.left_panel}>
        <Subsection title='Fields & Variables'>
            <Query query={GET_STUDY} variables={{ studyId }}>
            {({ loading, data, error }) => {
                if (loading) return <LoadingBalls/>;
                if (error) return <p>Error :( {JSON.stringify(error)}</p>; 
                return <>
                    {
                       data.getStudy.fields ? <FieldListSection checkable={false} fieldList={data.getStudy.fields}/> :
                        <p>There is no field annotations uploaded for this study yet.</p> 
                    }
                    <UploadNewFields studyId={studyId}/>
                </>;
            }}
            </Query>
            
        </Subsection>
        </div>
        <div className={css.tab_page_wrapper + ' ' + css.right_panel}>
            <Subsection title='Data'>
                <DataSummary studyId={studyId}/>
            </Subsection>
            <DataVersions studyId={studyId}/> {/* <Subsection> wrap is inside <DataVersion> because if versions num < 2 the whole section doesnt show */}
            <Subsection title='Upload new data'>
                <UploadNewData studyId={studyId}/>
            </Subsection>
        </div>
    </div>;
};