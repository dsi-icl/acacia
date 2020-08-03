import * as React from 'react';
import { Query } from '@apollo/client/react/components';
import { NavLink, Route, Switch } from 'react-router-dom';
import { GET_STUDY } from 'itmat-commons';
import { LoadingBalls } from '../reusable/icons/loadingBalls';
import css from './projectPage.module.css';
import { DashboardTabContent, DataManagementTabContentFetch, ProjectsTabContent, AdminTabContent } from './tabContent';
import { FileRepositoryTabContent } from './tabContent/files/fileTab';

export const DatasetDetailPage: React.FunctionComponent<{ studyId: string }> = ({ studyId }) => {
    return (
        <Query<any, any>
            query={GET_STUDY}
            variables={{ studyId }}
            errorPolicy='ignore' // quick fix ; TO_DO change to split graphql requests coupled with UI
        >
            {({ loading, error, data }) => {
                if (loading) { return <LoadingBalls />; }
                if (error) { return <p>Error :( {JSON.stringify(error)}</p>; }
                if (!data || !data.getStudy) { return <div>Oops! Cannot find this dataset.</div>; }
                return <div className={css.page_container}>
                    <div className={css.ariane}>
                        <h2>{data.getStudy.name.toUpperCase()}</h2>
                        <div className={css.tabs}>
                            <NavLink to={`/datasets/${studyId}/dashboard`} activeClassName={css.active}><div>DASHBOARD</div></NavLink>
                            <NavLink to={`/datasets/${studyId}/data_management`} activeClassName={css.active}><div>DATA MANAGEMENT</div></NavLink>
                            <NavLink to={`/datasets/${studyId}/files`} activeClassName={css.active}><div>FILES REPOSITORY</div></NavLink>
                            <NavLink to={`/datasets/${studyId}/projects`} activeClassName={css.active}><div>PROJECTS</div></NavLink>
                            <NavLink to={`/datasets/${studyId}/admin`} activeClassName={css.active}><div>ADMINISTRATION</div></NavLink>
                        </div>
                    </div>
                    <div className={css.content}>
                        <Switch>
                            <Route path='/datasets/:studyId/dashboard' render={() => <DashboardTabContent studyId={studyId} jobs={data.getStudy.jobs} />} />
                            <Route path='/datasets/:studyId/data_management' render={({ match }) => <DataManagementTabContentFetch studyId={match.params.studyId} />} />
                            <Route path='/datasets/:studyId/files' render={() => <FileRepositoryTabContent studyId={studyId} />} />
                            <Route path='/datasets/:studyId/projects' render={({ match }) => <ProjectsTabContent studyId={match.params.studyId} projectList={data.getStudy.projects} />} />
                            <Route path='/datasets/:studyId/admin' component={AdminTabContent} />
                            <Route path='/datasets/:studyId/' render={() => <></>} />
                        </Switch>
                    </div>
                </div>;
            }}
        </Query>
    );
};
