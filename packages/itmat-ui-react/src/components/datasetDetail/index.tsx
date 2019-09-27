import * as React from 'react';
import { Route, Switch, NavLink, Redirect } from 'react-router-dom';
import * as css from './projectPage.module.css';
import { Query } from 'react-apollo';
import { GET_PROJECT } from '../../graphql/projects';
import { DashboardTabContent, ProjectsTabContent, DataManagementTabContent } from './tabContent';
import { LoadingBalls } from '../reusable/loadingBalls';
import { GET_STUDY } from '../../graphql/study';
import { FileRepositoryTabContent } from './tabContent/files/fileTab';
import { ProjectDetail } from './tabContent/projects/detailSections/projectDetail';

export const DatasetDetailPage: React.FunctionComponent<{ studyId: string }> = ({ studyId })=> {
    return (
        <Query
            query={GET_STUDY}
            variables={{ studyId }}
        >
        {({loading, error, data }) => {
            if (loading) return <LoadingBalls/>;
            if (error) return <p>Error :( {JSON.stringify(error)}</p>;
            if (!data || !data.getStudy) return <div>Oops! Cannot find this dataset.</div>
            return <div className={css.page_container}>
                <div className='page_ariane'>{data.getStudy.name.toUpperCase()}</div>
                <div className={css.tabs}>
                    <div>
                        <NavLink to={`/datasets/${studyId}/dashboard`} activeClassName={css.active}><div>DASHBOARD</div></NavLink>
                        <NavLink to={`/datasets/${studyId}/data_management`} activeClassName={css.active}><div>DATA MANAGEMENT</div></NavLink> 
                        <NavLink to={`/datasets/${studyId}/files`} activeClassName={css.active}><div>FILES REPOSITORY</div></NavLink> 
                        <NavLink to={`/datasets/${studyId}/projects`} activeClassName={css.active}><div>PROJECTS</div></NavLink>
                        <NavLink to={`/datasets/${studyId}/admin`} activeClassName={css.active}><div>ADMINISTRATION</div></NavLink>
                    </div>
                </div>
                <div className={css.content}>
                        <Switch>
                            <Route path='/datasets/:studyId/dashboard' render={() => <DashboardTabContent jobs={data.getStudy.jobs}/>}/>
                            <Route path='/datasets/:studyId/data_management' render={({ match }) => <DataManagementTabContent studyId={match.params.studyId}/>}/>
                            <Route path='/datasets/:studyId/files' render={({ match }) => <FileRepositoryTabContent studyId={studyId}/>}/>
                            <Route path='/datasets/:studyId/projects/:projectId' render={({ match }) => <ProjectDetail projectId={match.params.projectId}  studyId={match.params.studyId}/>}/>
                            <Route path='/datasets/:studyId/projects' render={({ match }) => <ProjectsTabContent studyId={match.params.studyId} projectList={data.getStudy.projects}/>}/>
                            <Route path='/datasets/:studyId/admin' render={() => <></>}/>
                            <Route path='/datasets/:studyId/' render={() => <></>}/>
                        </Switch>
                </div>
            </div>;
        }}
        </Query>
    );
};