import React from 'react';
import { Mutation, Query } from 'react-apollo';
import * as css from './tabContent.module.css';
import { GET_STUDY } from '../../../../graphql/study';
import { IStudy } from 'itmat-utils/dist/models/study';
import { LoadingBalls } from '../../../reusable/loadingBalls';
import { formatBytes } from '../../../reusable/fileList';
import { Subsection } from '../../../reusable';
// number of patients 
// newest version of data - date / tag
// download data
// data curation pipeline
// upload new sets of data

export const DataSummary: React.FunctionComponent<{ studyId: string, showSaveVersionButton: boolean }> = ({ showSaveVersionButton, studyId }) => {
    return   <Query query={GET_STUDY} variables={{ studyId }}>
            {({ loading, data, error }) => {
                if (loading) return <LoadingBalls/>;
                if (error) return <p>Error :( {JSON.stringify(error)}</p>; 
                if (data.getStudy && data.getStudy.currentDataVersion !== null && data.getStudy.currentDataVersion !== undefined && data.getStudy.dataVersions && data.getStudy.dataVersions[data.getStudy.currentDataVersion]) {
                    return <DataSumaryVisual showSaveVersionButton={showSaveVersionButton} studyId={studyId} currentVersion={data.getStudy.currentDataVersion} versions={data.getStudy.dataVersions} key={data.getStudy.id}/>;
                }
                return <p>There is no data uploaded for this study yet.</p>; 
            }}
        </Query>;
};


const DataSumaryVisual: React.FunctionComponent<{ studyId: string, showSaveVersionButton: boolean, currentVersion: number, versions: { 
    id: string,
    version: string,
    tag?: string,
    fileSize: number,
    uploadDate: string,
    jobId: string,
    extractedFrom: string}[] }> = ({ studyId, currentVersion, versions, showSaveVersionButton }) => {
    const [selectedVersion, setSelectedVersion] = React.useState(currentVersion);

    const {id, version, tag, uploadDate, jobId, fileSize, extractedFrom} = versions[selectedVersion];

    return <>
        { selectedVersion === currentVersion ? null : <><span className='warning_banner'>Warning: You are not looking at the current version of the data.</span><br/><br/><br/></> }
        <div className={css.data_summary_section}>
        <NumberOfPatients studyId={studyId} key={id}/>
        <NewestVersionOfData version={version || 'n/a'}/>
        <VersionTag tag={tag || 'n/a'}/>
        <DateOfUpload date={uploadDate}/>
        <FileSize size={ (fileSize && formatBytes(fileSize)) || 'n/a' }/>
        <OriginalFile fileName={extractedFrom || 'n/a'}/>
        </div>
        { versions.length >= 2 ? <><h5>Data versioning</h5>
            { versions.map((el, ind) =>
                <React.Fragment key={el.id}>
                    <div 
                        key={el.id}
                        onClick={() => setSelectedVersion(ind)}
                        className={css.data_version_cube + ( ind === selectedVersion ? ( ind === currentVersion ? ` ${css.data_version_cube_current}` : ` ${css.data_version_cube_selected_not_current}`) : '' )}>{`${el.version}${el.tag ? ` (${el.tag})` : ''}`}
                    </div>
                    {ind === versions.length - 1 ? null : <span className={css.arrow}>⟶</span>}
                </React.Fragment>
            )}
            <br/><br/>
            { showSaveVersionButton ? <button>Save version</button> : null }<br/>
        </> : null }
    </>;
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
        <p>Dataset version</p>
        <span className={css.number_highlight}>{version}</span>
    </div>;
};

const VersionTag: React.FunctionComponent<{ tag: string }> = ({ tag }) => {
    if (!tag) return <div style={{  gridArea: 'tag'}} >Current version of data is not tagged.</div>;
    return <div style={{  gridArea: 'tag'}}>
        <p>Dataset version tag</p>
        <span className={css.number_highlight}>{tag}</span>
    </div>;
};

const OriginalFile: React.FunctionComponent<{ fileName: string }> = ({ fileName }) => {
    return <div style={{  gridArea: 'filename'}}>
        <p>Data were extracted from</p>
        <span className={css.number_highlight}>{fileName}</span>
    </div>;
};

const DateOfUpload: React.FunctionComponent<{ date: string /* UNIX timestamp */}> = ({ date }) => {
    return <div style={{ gridArea: 'date'}}>
        <p>Data were uploaded on</p>
        <span className={css.number_highlight}>{date ? (new Date(parseInt(date))).toLocaleString() : 'n/a'}</span>
    </div>
};

const FileSize: React.FunctionComponent<{size: string}> = ({ size }) => {
    return <div style={{ gridArea: 'dummy'}}>
        <p>Original data file size</p>
        <span className={css.number_highlight}>{size}</span>
    </div>;
};


///////////////////////////////////////////////////////////////////////////////////

