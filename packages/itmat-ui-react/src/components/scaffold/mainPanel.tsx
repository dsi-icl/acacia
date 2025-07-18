import { FunctionComponent } from 'react';
import { Route, Routes, Navigate } from 'react-router-dom';
import { DatasetDetailPage } from '../datasetDetail';
import { DatasetListPage } from '../datasetList';
import { UserPage } from '../users';
import { LogPage } from '../log';
import { ProfilePage } from '../profile';
import css from './scaffold.module.css';
import { DrivePage } from '../drive';
import { DomainPage } from '../domain';
import { OrganisationPage } from '../organisation';
import { InstancePage } from '../instance';
import { LXDPage } from '../lxd';
import { ProtectedRoute } from '../reusable/protectedRoute/protectedRoute';

export const MainPanel: FunctionComponent = () => {
    return (
        <div className={css.main_panel}>
            <Routes>
                <Route path='/datasets/:studyId/*' element={<DatasetDetailPage />} />
                <Route path='/datasets' element={<DatasetListPage />} />
                <Route element={
                    <ProtectedRoute
                        restrictedUserTypes={['GUEST']}
                        redirectPath="/datasets" // Redirect to datasets instead of access denied
                    />
                }>
                    <Route path='/users' element={<UserPage />} />
                    <Route path='/users/:userId' element={<UserPage />} />
                    <Route path='/logs' element={<LogPage />} />
                    <Route path='/domains' element={<DomainPage />} />
                    <Route path='/organisations' element={<OrganisationPage />} />
                    <Route path='/drive' element={<DrivePage />} />
                    <Route path='/pun/sys/dashboard' />
                    <Route path='/instances' element={<InstancePage />} />
                    <Route path='/lxd' element={<LXDPage />} />
                </Route>
                <Route path='/profile' element={<ProfilePage />} />
                <Route path='*' element={<Navigate to='/datasets' />} />
            </Routes>
        </div>
    );
};
