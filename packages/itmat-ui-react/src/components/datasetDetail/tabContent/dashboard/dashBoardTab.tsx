import { IJobEntry } from 'itmat-commons/dist/models/job';
import * as React from 'react';
import { Subsection } from '../../../reusable/subsection';
import { JobSection } from './jobs';
import * as css from './tabContent.module.css';

export const DashboardTabContent: React.FunctionComponent<{ jobs: IJobEntry<any>[] }> = ({ jobs }) => {
    return <div className={css.tab_page_wrapper}>
        <Subsection title="Past Jobs">
            <JobSection jobs={jobs} />
        </Subsection>
    </div>;
};
