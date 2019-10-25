import * as React from 'react';
import { Query } from 'react-apollo';
import { NavLink, Redirect, Route, Switch } from 'react-router-dom';
import { GET_PROJECT } from '../../graphql/projects';
import { LoadingBalls } from '../reusable/loadingBalls';
import * as css from './projectPage.module.css';
import { AdminTabContent, DashboardTabContent, DataTabContent } from './tabContent';
import { FileTabContent } from './tabContent/file/fileTab';

export const ProjectDetailPage: React.FunctionComponent<{ projectId: string }> = ({ projectId }) => {
    return (
        <Query
            query={GET_PROJECT}
            variables={{ projectId, admin: true }}
        >
            {({ loading, error, data }) => {
                if (loading) { return <LoadingBalls />; }
                if (error) { return <p>Error :( {JSON.stringify(error)}</p>; }
                if (!data || !data.getProject) { return <div>Oops! Cannot find this project.</div>; }
                return <div className={css.page_container}>
                    <div className="page_ariane">{data.getProject.name.toUpperCase()}</div>
                    <div className={css.tabs}>
                        <div>
                            <NavLink to={`/projects/${projectId}/dashboard`} activeClassName={css.active}><div>DASHBOARD</div></NavLink>
                            <NavLink to={`/projects/${projectId}/samples`} activeClassName={css.active}><div>SAMPLE</div></NavLink>
                            <NavLink to={`/projects/${projectId}/data`} activeClassName={css.active}><div>DATA</div></NavLink>
                            <NavLink to={`/projects/${projectId}/files`} activeClassName={css.active}><div>FILE REPOSITORY</div></NavLink>
                            <NavLink to={`/projects/${projectId}/admin`} activeClassName={css.active}><div>ADMINISTRATION</div></NavLink>
                        </div>
                    </div>
                    <div className={css.content}>
                        <Switch>
                            <Route path="/projects/:projectId/dashboard" render={() => <DashboardTabContent studyId={data.getProject.studyId} jobs={data.getProject.jobs} />} />
                            <Route path="/projects/:projectId/admin" render={({ match }) => <AdminTabContent studyId={data.getProject.studyId} projectId={match.params.projectId} roles={data.getProject.roles} />} />
                            <Route path="/projects/:projectId/samples" render={() => <></>} />
                            <Route path="/projects/:projectId/data" render={() => <DataTabContent studyId={data.getProject.studyId} projectId={projectId} />} />
                            <Route path="/projects/:projectId/files" render={() => <FileTabContent projectId={projectId} studyId={data.getProject.studyId} />} />
                            <Route path="/projects/:projectId/" render={() => <Redirect to={`/projects/${projectId}/dashboard`} />} />
                        </Switch>
                    </div>
                </div>;
            }}
        </Query>
    );
};
