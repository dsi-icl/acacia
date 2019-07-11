import React from 'react';
import { Mutation, Query } from 'react-apollo';
import * as css from './tabContent.module.css';
import { GET_STUDY } from '../../../../graphql/study';
import { IStudy } from 'itmat-utils/dist/models/study';
import { LoadingBalls } from '../../../reusable/loadingBalls';
import { formatBytes } from '../../../reusable/fileList';
import { Subsection } from '../../../reusable';

export const DataVersions: React.FunctionComponent<{studyId: string }> = ({ studyId }) => {
    return   <Query query={GET_STUDY} variables={{ studyId }}>
            {({ loading, data, error }) => {
                if (loading) return null;
                if (error) return <p>Error :( {JSON.stringify(error)}</p>; 
                if (data.getStudy && data.getStudy.currentDataVersion !== null && data.getStudy.currentDataVersion !== undefined && data.getStudy.dataVersions && data.getStudy.dataVersions[data.getStudy.currentDataVersion] && data.getStudy.dataVersions.length > 1) {
                    return <Subsection title='Data versioning'>
                        <DataVersionsVisual currentVersion={data.getStudy.currentDataVersion} versions={data.getStudy.dataVersions} studyId={studyId}/><br/><br/><br/>
                    </Subsection>;
                }
                return null; 
            }}
        </Query>;
};

const DataVersionsVisual: React.FunctionComponent<{ studyId: string, currentVersion: number, versions: { 
    id: string,
    version: string,
    tag?: string,
    fileSize: number,
    uploadDate: number,
    jobId: string,
    extractedFrom: string}[] }> = ({ studyId, currentVersion, versions }) => {
        return <>{
            versions.map((el, ind) =>
                <React.Fragment key={el.id}><div key={el.id} className={css.data_version_cube + ( ind === currentVersion ? ` ${css.data_version_cube_current}` : '' )}>{`${el.version}${el.tag ? ` (${el.tag})` : ''}`}</div>{ind === versions.length - 1 ? null : <span className={css.arrow}>⟶</span>}</React.Fragment>
            )}
        </>;
};

