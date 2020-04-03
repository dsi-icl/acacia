import * as React from 'react';
import { Route, Switch } from 'react-router-dom';
import { DatasetDetailPage } from '../datasetDetail';
import { DatasetListPage } from '../datasetList';
import { ProjectDetailPage } from '../projectDetail';
import { ProjectListPage } from '../projectList';
import { UserPage } from '../users';
import css from './scaffold.module.css';

export const MainPanel: React.FC = () => (
    <div className={css.main_panel}>
        <Switch>
            <Route path="/projects/:projectId" component={ProjectDetailPage} />
            <Route path="/projects" component={ProjectListPage} />
            <Route path="/datasets/:studyId" component={DatasetDetailPage} />
            <Route path="/datasets" component={DatasetListPage} />
            <Route path="/users" component={UserPage} />
            <Route path="/" render={() => <></>} />
        </Switch>
    </div>
);
