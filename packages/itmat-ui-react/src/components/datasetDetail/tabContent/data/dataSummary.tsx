import React from 'react';
import { Mutation, Query } from 'react-apollo';
import * as css from './tabContent.module.css';
import { GET_STUDY } from '../../../../graphql/study';
import { IStudy } from 'itmat-utils/dist/models/study';
import { LoadingBalls } from '../../../reusable/loadingBalls';
import { formatBytes } from '../../../reusable/fileList';
// number of patients 
// newest version of data - date / tag
// download data
// data curation pipeline
// upload new sets of data
export const DataSummary: React.FunctionComponent<{studyId: string }> = ({ studyId }) => {
    return   <Query query={GET_STUDY} variables={{ studyId }}>
            {({ loading, data, error }) => {
                if (loading) return <LoadingBalls/>;
                if (error) return <p>Error :( {JSON.stringify(error)}</p>; 
                if (data.getStudy && data.getStudy.currentDatasetVersion) {
                    const {id, currentDataFileSize, currentDataIsExtractedFrom, currentDataIsUploadedOn, currentDatasetTag, currentDatasetVersion} = data.getStudy;
                    return <div className={css.data_summary_section}>
                        <NumberOfPatients studyId={id}/>
                        <NewestVersionOfData version={currentDatasetVersion || 'n/a'}/>
                        <VersionTag tag={currentDatasetTag || 'n/a'}/>
                        <DateOfUpload date={currentDataIsUploadedOn!}/>
                        <FileSize size={ (currentDataFileSize && formatBytes(currentDataFileSize)) || 'n/a' }/>
                        <OriginalFile fileName={currentDataIsExtractedFrom || 'n/a'}/>
                    </div>;
                }
                return <p>There is no data uploaded for this study yet.</p>; 
            }}
        </Query>;
};



//////////////////////////COMPONENTS WITHIN THE PAGE//////////////////////////////////////
const NumberOfPatients: React.FunctionComponent<{ studyId: string }> = ({ studyId }) => {
    return <div style={{  gridArea: 'patients'}}>
        <p>Number of subjects in this dataset</p>
        <span className={css.number_highlight}>
            <Query query={GET_STUDY} variables={{ studyId }}>
            {({ loading, data, error }) => {
                if (loading) return '...';
                if (error || !data || !data.getStudy || data.getStudy.numOfSubjects === undefined) return 'n/a';
                return data.getStudy.numOfSubjects;
            }}
            </Query>
        </span>
    </div>;
};

const NewestVersionOfData: React.FunctionComponent<{ version: string }> = ({ version }) => {
    return <div style={{  gridArea: 'version'}}>
        <p>Current version of the data</p>
        <span className={css.number_highlight}>{version}</span>
    </div>;
};

const VersionTag: React.FunctionComponent<{ tag: string }> = ({ tag }) => {
    if (!tag) return <div style={{  gridArea: 'tag'}} >Current version of data is not tagged.</div>;
    return <div style={{  gridArea: 'tag'}}>
        <p>Current dataset version tag</p>
        <span className={css.number_highlight}>{tag}</span>
    </div>;
};

const OriginalFile: React.FunctionComponent<{ fileName: string }> = ({ fileName }) => {
    return <div style={{  gridArea: 'filename'}}>
        <p>Current data is extracted from</p>
        <span className={css.number_highlight}>{fileName}</span>
    </div>;
};

const DateOfUpload: React.FunctionComponent<{ date: string /* UNIX timestamp */}> = ({ date }) => {
    return <div style={{ gridArea: 'date'}}>
        <p>Current data is uploaded on</p>
        <span className={css.number_highlight}>{date ? (new Date(parseInt(date))).toLocaleString() : 'n/a'}</span>
    </div>
};

const FileSize: React.FunctionComponent<{size: string}> = ({ size }) => {
    return <div style={{ gridArea: 'dummy'}}>
        <p>Original data file size</p>
        <span className={css.number_highlight}>{size}</span>
    </div>;
};
