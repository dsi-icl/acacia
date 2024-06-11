import { FunctionComponent } from 'react';
import { GET_PROJECT } from '@itmat-broker/itmat-models';
import { IJobEntry } from '@itmat-broker/itmat-types';
import { Subsection } from '../../../reusable/subsection/subsection';
import { JobSection } from './jobs';
import { useQuery } from '@apollo/client/react/hooks';
import LoadSpinner from '../../../reusable/loadSpinner';
import css from './tabContent.module.css';

export const DashboardTabContent: FunctionComponent<{ studyId: string; projectId: string; jobs: Array<IJobEntry> }> = ({ projectId, jobs }) => {
    const { loading: getProjectLoading, error: getProjectError, data: getProjectData } = useQuery(GET_PROJECT, { variables: { projectId: projectId, admin: false } });
    if (getProjectLoading) {
        return <LoadSpinner />;
    }
    if (getProjectError) {
        return <div className={`${css.tab_page_wrapper} ${css.both_panel} ${css.upload_overlay}`}>
            An error occured, please contact your administrator
        </div>;
    }
    return <div className={css.tab_page_wrapper}>
        <Subsection title='Data summary'>
            <span>Data Version: {getProjectData.getProject.dataVersion?.version ?? 'NA'}</span>
        </Subsection><br />
        <Subsection title='Past Jobs'>
            <JobSection jobs={jobs} />
        </Subsection>
    </div>;
};
