import React from 'react';
import { Mutation, Query } from 'react-apollo';
import * as css from './tabContent.module.css';
import { GET_STUDY } from '../../../../graphql/study';
// number of patients 
// newest version of data - date / tag
// download data
// data curation pipeline
// upload new sets of data
export const DataSummary: React.FunctionComponent<{studyId: string}> = ({ studyId }) => {
    return <div className={css.data_summary_section}>
        <NumberOfPatients studyId={studyId}/>
        <NewestVersionOfData version={0.4}/>
        <VersionTag tag='init'/>
        <DateOfUpload date={10000000000000}/>
        <Dummy/>
        <OriginalFile fileName='biteMeEatShorts.tsv'/>
    </div>;
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

const NewestVersionOfData: React.FunctionComponent<{ version: number }> = ({ version }) => {
    return <div style={{  gridArea: 'version'}}>
        <p>Current version of the data</p>
        <span className={css.number_highlight}>{`v${version}`}</span>
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

const DateOfUpload: React.FunctionComponent<{ date: number /* UNIX timestamp */}> = ({ date }) => {
    return <div style={{ gridArea: 'date'}}>
        <p>Current data is uploaded on</p>
        <span className={css.number_highlight}>{(new Date(date)).toLocaleString()}</span>
    </div>
};

const Dummy: React.FunctionComponent = () => {
    return <div style={{ gridArea: 'dummy'}}>
        <p>I am a</p>
        <span className={css.number_highlight}>tea pot</span>
    </div>;
};

const UploadNewSetsOfData: React.FunctionComponent = () => {
    return <div>
        
    </div>;
};