import { Models } from 'itmat-utils';
import * as React from 'react';
import { Query, Mutation } from 'react-apollo';
import { GET_PROJECT } from '../../../../graphql/projects';
import { CREATE_USER } from '../../../../graphql/appUsers';
import * as css from './tabContent.module.css';
import { NavLink, Redirect } from 'react-router-dom';
import { IJobEntry } from 'itmat-utils/dist/models/job';
import { Subsection } from '../../../reusable/subsection';
import { JobSection } from './jobs';
import { DataSummary } from '../../../datasetDetail/tabContent/data/dataSummary';

export const DashboardTabContent: React.FunctionComponent<{ studyId: string, jobs: IJobEntry<any>[] }> = ({ studyId, jobs }) => {
    return <div className={css.tab_page_wrapper}>
        <Subsection title='Data summary'>
            <DataSummary studyId={studyId}/>
        </Subsection>
        <Subsection title='Past Jobs'>
            <JobSection jobs={jobs}/>
        </Subsection>
    </div>;
};
