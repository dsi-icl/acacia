import * as React from 'react';
import { Route, Switch } from 'react-router-dom';
import * as css from './scaffold.module.css';
import { UserPage } from '../users';
import { ProjectListPage } from '../projectList';
import { DatasetListPage } from '../datasetList';
import { ProjectDetailPage } from '../projectDetail';
import { DatasetDetailPage } from '../datasetDetail';

export const MainPanel: React.FunctionComponent = props => {
    return (
        <div className={css.main_panel}>
            <Switch>
                <Route path='/projects/:projectId' render={({ match }) => <ProjectDetailPage projectId={match.params.projectId}/>}/>
                <Route path='/projects' render={({match}) => <ProjectListPage/>}/>
                <Route path='/datasets/:studyId' render={({ match }) => <DatasetDetailPage studyId={match.params.studyId}/>}/>
                <Route path='/datasets' render={() => <DatasetListPage/>}/>
                <Route path='/users' render={() => <UserPage/>}/>
                <Route path='/' render={() => <></>}/>
            </Switch>
        </div>
    );
};