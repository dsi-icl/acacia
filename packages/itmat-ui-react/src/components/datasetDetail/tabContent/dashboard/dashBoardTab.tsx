import { IJobEntry } from 'itmat-commons';
import * as React from 'react';
import { Subsection } from '../../../reusable/subsection/subsection';
import { JobSection } from './jobs';
import css from './tabContent.module.css';

export const DashboardTabContent: React.FunctionComponent<{ studyId: string; jobs: Array<IJobEntry<any>> }> = ({ studyId, jobs }) => {
    return <div className={`${css.tab_page_wrapper} fade_in`}>
        <Subsection title='Past Jobs'>
            <JobSection studyId={studyId} jobs={jobs} />
        </Subsection>
    </div>;
};
