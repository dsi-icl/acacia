import { FunctionComponent } from 'react';
import { Query } from '@apollo/client/react/components';
import { NavLink, Navigate, Route, Routes, useParams } from 'react-router-dom';
import { GET_PROJECT, WHO_AM_I } from '@itmat-broker/itmat-models';
import { userTypes } from '@itmat-broker/itmat-types';
import LoadSpinner from '../reusable/loadSpinner';
import css_dataset from '../datasetDetail/projectPage.module.css';
import { AdminTabContent, DashboardTabContent, DataTabContent } from './tabContent';
import { FileTabContent } from './tabContent/file/fileTab';
import { AnalysisTabContent } from './tabContent/analysis/analysisTab';

export const ProjectDetailPage: FunctionComponent = () => {
    const { projectId } = useParams();
    return (
        <Query<any, any>
            query={GET_PROJECT}
            variables={{ projectId, admin: true }}
        >
            {({ loading, error, data }) => {
                if (loading) { return <LoadSpinner />; }
                if (error) { return <p>Error {JSON.stringify(error)}</p>; }
                if (!data || !data.getProject) { return <div>Oops! Cannot find this project.</div>; }

                return <div className={css_dataset.page_container}>
                    <div className={css_dataset.ariane}>
                        <h2>{data.getProject.name.toUpperCase()}</h2>
                        <Query<any, any> query={WHO_AM_I}>
                            {({ loading, error, data: sessionData }) => {
                                if (loading) return <LoadSpinner />;
                                if (error) return <p>{error.toString()}</p>;
                                if (sessionData.whoAmI.type === userTypes.ADMIN) {
                                    return <div className={css_dataset.tabs}>
                                        <NavLink to='dashboard' className={({ isActive }) => isActive ? css_dataset.active : undefined}><div>DASHBOARD</div></NavLink>
                                        {/* <NavLink to='samples' className={({ isActive }) => isActive ? className={({ isActive }) => isActive ? css.active : undefined}><div>SAMPLE</div></NavLink> */}
                                        <NavLink to='data' className={({ isActive }) => isActive ? css_dataset.active : undefined}><div>DATA</div></NavLink>
                                        <NavLink to='analysis' className={({ isActive }) => isActive ? css_dataset.active : undefined}><div>ANALYSIS</div></NavLink>
                                        <NavLink to='files' className={({ isActive }) => isActive ? css_dataset.active : undefined}><div>FILE REPOSITORY</div></NavLink>
                                        <NavLink to='admin' className={({ isActive }) => isActive ? css_dataset.active : undefined}><div>ADMINISTRATION</div></NavLink>
                                    </div>;
                                } else {
                                    return <div className={css_dataset.tabs}>
                                        <NavLink to='dashboard' className={({ isActive }) => isActive ? css_dataset.active : undefined}><div>DASHBOARD</div></NavLink>
                                        {/* <NavLink to='samples' className={({ isActive }) => isActive ? className={({ isActive }) => isActive ? css.active : undefined}><div>SAMPLE</div></NavLink> */}
                                        <NavLink to='data' className={({ isActive }) => isActive ? css_dataset.active : undefined}><div>DATA</div></NavLink>
                                        <NavLink to='analysis' className={({ isActive }) => isActive ? css_dataset.active : undefined}><div>ANALYSIS</div></NavLink>
                                        {/* <NavLink to='files' className={({ isActive }) => isActive ? css_dataset.active : undefined}><div>FILE REPOSITORY</div></NavLink> */}
                                    </div>;
                                }
                            }}
                        </Query>
                    </div>
                    <div className={css_dataset.content}>
                        <Routes>
                            <Route path='dashboard' element={<DashboardTabContent studyId={data.getProject.studyId} projectId={data.getProject.id} jobs={data.getProject.jobs} />} />
                            <Route path='admin' element={<AdminTabContent studyId={data.getProject.studyId} roles={data.getProject.roles} />} />
                            {/* <Route path="samples" element={() => <></>} /> */}
                            <Route path='data' element={<DataTabContent studyId={data.getProject.studyId} />} />
                            <Route path='analysis' element={<AnalysisTabContent studyId={data.getProject.studyId} />} />
                            <Route path='files' element={<FileTabContent studyId={data.getProject.studyId} />} />
                            <Route path='*' element={<Navigate to='dashboard' />} />
                        </Routes>
                    </div>
                </div>;
            }}
        </Query>
    );
};
