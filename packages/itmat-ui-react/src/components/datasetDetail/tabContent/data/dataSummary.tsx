import React from 'react';
import { Query } from '@apollo/client/react/components';
import { GET_STUDY, IStudyDataVersion } from 'itmat-commons';
import { formatBytes } from '../../../reusable/fileList/fileList';
import css from './tabContent.module.css';
// number of patients
// newest version of data - date / tag
// download data
// data curation pipeline
// upload new sets of data

export const DataSummaryVisual: React.FunctionComponent<{ studyId: string; selectedVersion: number; currentVersion: number; versions: IStudyDataVersion[] }> = ({ studyId, currentVersion, selectedVersion, versions }) => {

    const { id, version, tag, uploadDate, fileSize, extractedFrom } = versions[selectedVersion];

    return <>
        {selectedVersion === currentVersion ? null : <><span className='warning_banner'>Warning: You are not looking at the current version of the data.</span><br /><br /><br /></>}
        <div className={css.data_summary_section}>
            <NumberOfPatients studyId={studyId} key={id} />
            <NewestVersionOfData version={version || 'n/a'} />
            <VersionTag tag={tag || 'n/a'} />
            <DateOfUpload date={uploadDate} />
            <FileSize size={(fileSize && formatBytes(parseInt(fileSize, 10))) || 'n/a'} />
            <OriginalFile fileName={extractedFrom || 'n/a'} />
        </div>

    </>;
};




////////////////////////// COMPONENTS WITHIN THE PAGE//////////////////////////////////////
const NumberOfPatients: React.FunctionComponent<{ studyId: string }> = ({ studyId }) => {
    return <div style={{ gridArea: 'patients' }}>
        <div>
            <p>Number of subjects</p>
            <span className={css.number_highlight}>
                <Query<any, any> query={GET_STUDY} variables={{ studyId }}>
                    {({ loading, data, error }) => {
                        if (loading) { return '...'; }
                        if (error || !data || !data.getStudy || data.getStudy.numOfSubjects === undefined) { return 'n/a'; }
                        return data.getStudy.numOfSubjects;
                    }}
                </Query>
            </span>
        </div>
    </div>;
};

const NewestVersionOfData: React.FunctionComponent<{ version: string }> = ({ version }) => {
    return <div style={{ gridArea: 'version' }}><div>
        <p>Dataset version</p>
        <span className={css.number_highlight}>{version}</span>
    </div>
    </div>;
};

const VersionTag: React.FunctionComponent<{ tag: string }> = ({ tag }) => {
    if (!tag) { return <div style={{ gridArea: 'tag' }} >Current version of data is not tagged.</div>; }
    return <div style={{ gridArea: 'tag' }}><div>
        <p>Dataset version tag</p>
        <span className={css.number_highlight}>{tag}</span>
    </div>
    </div>;
};

const OriginalFile: React.FunctionComponent<{ fileName: string }> = ({ fileName }) => {
    return <div style={{ gridArea: 'filename' }}>
        <div>
            <p>Data were extracted from</p>
            <span className={css.number_highlight}>{fileName}</span>
        </div>
    </div>;
};

const DateOfUpload: React.FunctionComponent<{ date: string | number /* UNIX timestamp */ }> = ({ date }) => {
    return <div style={{ gridArea: 'date' }}><div>
        <p>Data were uploaded on</p>
        <span className={css.number_highlight}>{date ? (new Date(parseInt(date as any))).toLocaleString() : 'n/a'}</span>
    </div></div>;
};

const FileSize: React.FunctionComponent<{ size: string }> = ({ size }) => {
    return <div style={{ gridArea: 'dummy' }}>
        <div>
            <p>Original data file size</p>
            <span className={css.number_highlight}>{size}</span>
        </div>
    </div>;
};


///////////////////////////////////////////////////////////////////////////////////

