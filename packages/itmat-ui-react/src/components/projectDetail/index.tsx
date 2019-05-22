import * as React from 'react';
import { Route, Switch, NavLink, Redirect } from 'react-router-dom';
import * as css from './projectPage.module.css';
import { Query } from 'react-apollo';
import { GET_PROJECT } from '../../graphql/projects';
import { AdminTabContent } from './tabContent';

export const ProjectDetailPage: React.FunctionComponent<{ projectId: string }> = ({ projectId })=> {
    return (
        <div className={css.page_container}>
            <div className='page_ariane'>{projectId.toUpperCase()}</div>
            <div className={css.tabs}>
                <div>
                    <NavLink to={`/projects/${projectId}/dashboard`} activeClassName={css.active}><div>DASHBOARD</div></NavLink>
                    <NavLink to={`/projects/${projectId}/samples`} activeClassName={css.active}><div>SAMPLE</div></NavLink> 
                    <NavLink to={`/projects/${projectId}/data`} activeClassName={css.active}><div>DATA</div></NavLink>
                    <NavLink to={`/projects/${projectId}/admin`} activeClassName={css.active}><div>ADMIN</div></NavLink>
                </div>
            </div>
            <div className={css.content}>
                <Query
                    query={GET_PROJECT}
                    pollInterval={5000}
                    variables={{ projectId, admin: true }}
                >
                {({loading, error, data }) => {
                    if (loading) return <p>Loading...</p>;
                    if (error) return <p>Error :( {error}</p>;
                    return <Switch>
                        <Route path='/projects/:projectId/dashboard' render={() => <></>}/>
                        <Route path='/projects/:projectId/admin' render={() => <AdminTabContent roles={data.getProject.roles}/>}/>
                        <Route path='/projects/:projectId/samples' render={() => <></>}/>
                        <Route path='/projects/:projectId/data' render={() => <></>}/>
                        <Route path='/projects/:projectId/' render={() => <Redirect to={`/projects/${projectId}/dashboard`}/>}/>
                    </Switch>;
                }}
                </Query>
            </div>
        </div>
    );
};