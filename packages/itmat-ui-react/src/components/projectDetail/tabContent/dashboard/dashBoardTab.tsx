import { IJobEntry } from 'itmat-utils/dist/models/job';
import * as React from 'react';
import { Subsection } from '../../../reusable/subsection';
import { JobSection } from './jobs';
import * as css from './tabContent.module.css';

export const DashboardTabContent: React.FunctionComponent<{ studyId: string, jobs: Array<IJobEntry<any>> }> = ({ studyId, jobs }) => {
    return <div className={css.tab_page_wrapper}>
        <Subsection title="Data summary">
            {/* <DataSummary showSaveVersionButton={false} studyId={studyId}/> */}
        </Subsection>
        <Subsection title="Past Jobs">
            <JobSection jobs={jobs}/>
        </Subsection>
    </div>;
};
