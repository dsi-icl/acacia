import * as React from 'react';
import { Route, Switch, NavLink, Redirect } from 'react-router-dom';
import * as css from './projectPage.module.css';

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
                <Switch>
                    <Route path='/projects/:projectId/dashboard' render={() => <></>}/>
                    <Route path='/projects/:projectId/admin' render={() => <></>}/>
                    <Route path='/projects/:projectId/samples' render={() => <></>}/>
                    <Route path='/projects/:projectId/data' render={() => <></>}/>
                    <Route path='/projects/:projectId/' render={() => <Redirect to={`/projects/${projectId}/dashboard`}/>}/>
                </Switch>
            </div>
        </div>
    );
};