import { FunctionComponent } from 'react';
// import { Query } from '@apollo/client/react/components';
import { GET_STUDY } from '@itmat-broker/itmat-models';
import { IStudyDataVersion } from '@itmat-broker/itmat-types';
import css from './tabContent.module.css';
import { useQuery } from '@apollo/client/react/hooks';
import LoadSpinner from '../../../reusable/loadSpinner';
import { Tooltip } from 'antd';

export const DataSummaryVisual: FunctionComponent<{ studyId: string; selectedVersion: number; currentVersion: number; versions: IStudyDataVersion[] }> = ({ studyId, currentVersion, selectedVersion, versions }) => {
    const { data: getStudyData, loading: getStudyLoading } = useQuery(GET_STUDY, { variables: { studyId } });
    if (getStudyLoading) { return <LoadSpinner />; }

    return <>
        {selectedVersion === currentVersion ? null : <><span className='warning_banner'>Warning: You are not looking at the current version of the data.</span><br /><br /><br /></>}
        <div className={css.data_summary_section}>
            <NumberOfPatients data={getStudyData} key={'patients'} />
            <NumberOfRecords data={getStudyData} key={'records'} />
            <NewestVersionOfData version={versions[selectedVersion]?.version || 'n/a'} tag={versions[selectedVersion]?.tag || 'n/a'} key={'data'} />
            <NumberOfVisits data={getStudyData} key={'visits'} />
            <DateOfUpload date={versions[selectedVersion]?.life.createdTime} />
        </div>

    </>;
};

////////////////////////// COMPONENTS WITHIN THE PAGE//////////////////////////////////////
const NumberOfPatients: FunctionComponent<{ data }> = ({ data }) => {
    return <div style={{ gridArea: 'patients' }}>
        <div>
            <p>Number of subjects</p>
            <span className={css.number_highlight}>
                <Tooltip title={'Versioned / Unversioned'}>
                    {`${data.getStudy.subjects[0].length}/${data.getStudy.subjects[1].length}`}
                </Tooltip>
            </span>
        </div>
    </div>;
};

const NumberOfRecords: FunctionComponent<{ data }> = ({ data }) => {
    return <div style={{ gridArea: 'records' }}>
        <div>
            <p>Number of records</p>
            <span className={css.number_highlight}>
                <Tooltip title={'Versioned /Unversioned'}>
                    {`${data.getStudy.numOfRecords[0]}/${data.getStudy.numOfRecords[1]}`}
                </Tooltip>
            </span>
        </div>
    </div>;
};

const NewestVersionOfData: FunctionComponent<{ version: string, tag: string }> = ({ version, tag }) => {
    return <div style={{ gridArea: 'version' }}><div>
        <p>Current Data version</p>
        <span className={css.number_highlight}>{`${version} : ${tag}`}</span>
    </div>
    </div>;
};

const NumberOfVisits: FunctionComponent<{ data }> = ({ data }) => {
    return <div style={{ gridArea: 'visits' }}>
        <div>
            <p>Number of visits</p>
            <span className={css.number_highlight}>
                <Tooltip title={'Versioned / Unversioned'}>
                    {`${data.getStudy.visits[0].length}/${data.getStudy.visits[1].length}`}
                </Tooltip>
            </span>
        </div>
    </div>;
};

const DateOfUpload: FunctionComponent<{ date: string | number /* UNIX timestamp */ }> = ({ date }) => {
    return <div style={{ gridArea: 'date' }}><div>
        <p>Data were uploaded on</p>
        <span className={css.number_highlight}>{date ? (new Date(parseInt(`${date}`))).toLocaleString() : 'n/a'}</span>
    </div></div>;
};

///////////////////////////////////////////////////////////////////////////////////

