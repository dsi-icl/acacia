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

export const DashboardTabContent: React.FunctionComponent<{ jobs: IJobEntry<any>[] }> = ({ jobs }) => {
    return <div className={css.tab_page_wrapper}>
        <Subsection title='Past Jobs'>
            <JobSection jobs={jobs}/>
        </Subsection>
    </div>;
};
