import * as React from 'react';
import { IJobEntry } from 'itmat-commons';
import { Subsection } from '../../../reusable/subsection/subsection';
import { JobSection } from './jobs';
import css from './tabContent.module.css';

export const DashboardTabContent: React.FunctionComponent<{ studyId: string; jobs: Array<IJobEntry<any>> }> = ({ jobs }) => {
    return <div className={css.tab_page_wrapper}>
        <Subsection title='Data summary'>
            {/* <DataSummary showSaveVersionButton={false} studyId={studyId}/> */}
        </Subsection>
        <Subsection title='Past Jobs'>
            <JobSection jobs={jobs} />
        </Subsection>
    </div>;
};
