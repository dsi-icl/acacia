import { FunctionComponent } from 'react';
import { Route, Routes, Navigate } from 'react-router-dom';
import { DatasetDetailPage } from '../datasetDetail';
import { DatasetListPage } from '../datasetList';
import { ProjectDetailPage } from '../projectDetail';
import { ProjectListPage } from '../projectList';
import { UserPage } from '../users';
import { LogPage } from '../log';
import { ProfilePage } from '../profile';
import css from './scaffold.module.css';

export const MainPanel: FunctionComponent = () => {
    return (
        <div className={css.main_panel}>
            <Routes>
                <Route path='/projects/:projectId/*' element={<ProjectDetailPage />} />
                <Route path='/projects' element={<ProjectListPage />} />
                <Route path='/datasets/:studyId/*' element={<DatasetDetailPage />} />
                <Route path='/datasets' element={<DatasetListPage />} />
                <Route path='/users' element={<UserPage />} />
                <Route path='/users/:userId' element={<UserPage />} />
                <Route path='/logs' element={<LogPage />} />
                <Route path='/profile' element={<ProfilePage />} />
                <Route path='/pun/sys/dashboard' />
                <Route path='*' element={<Navigate to='/datasets' />} />
            </Routes>
        </div>
    );
};
