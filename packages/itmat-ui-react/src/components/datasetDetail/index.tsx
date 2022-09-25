import { FunctionComponent } from 'react';
import { Query } from '@apollo/client/react/components';
import { NavLink, Route, Routes, useParams, Navigate } from 'react-router-dom';
import { GET_STUDY, WHO_AM_I } from '@itmat-broker/itmat-models';
import { userTypes, studyType } from '@itmat-broker/itmat-types';
import LoadSpinner from '../reusable/loadSpinner';
import css from './projectPage.module.css';
import { DashboardTabContent, DataManagementTabContentFetch, ProjectsTabContent, AdminTabContent, FieldManagementTabContentFetch } from './tabContent';
import { FileRepositoryTabContent } from './tabContent/files/fileTab';

export const DatasetDetailPage: FunctionComponent = () => {
    const { studyId } = useParams();
    if (!studyId)
        return <LoadSpinner />;
    return (
        <Query<any, any>
            query={GET_STUDY}
            variables={{ studyId }}
            errorPolicy='ignore' // quick fix ; TO_DO change to split graphql requests coupled with UI
        >
            {({ loading, error, data }) => {
                if (loading) { return <LoadSpinner />; }
                if (error) { return <p>Error {JSON.stringify(error)}</p>; }
                if (!data || !data.getStudy) { return <div>Oops! Cannot find this dataset.</div>; }
                return <div className={css.page_container}>
                    <div className={css.ariane}>
                        <h2>{data.getStudy.name.toUpperCase()}</h2>
                        <div className={css.tabs}>
                            <Query<any, any> query={WHO_AM_I}>
                                {({ loading, error, data: sessionData }) => {
                                    if (loading) return <LoadSpinner />;
                                    if (error) return <p>{error.toString()}</p>;
                                    if (sessionData.whoAmI.type === userTypes.ADMIN) {
                                        return (
                                            <>
                                                <NavLink to='dashboard' className={({ isActive }) => isActive ? css.active : undefined}>DASHBOARD</NavLink>
                                                <NavLink to='field_management' className={({ isActive }) => isActive ? css.active : undefined}>DATA STANDARDIZATION</NavLink>
                                                <NavLink to='data_management' className={({ isActive }) => isActive ? css.active : undefined}>DATA MANAGEMENT</NavLink>
                                                <NavLink to='files' className={({ isActive }) => isActive ? css.active : undefined}>FILES REPOSITORY</NavLink>
                                                <NavLink to='admin' className={({ isActive }) => isActive ? css.active : undefined}>ADMINISTRATION</NavLink>
                                                <NavLink to='projects' className={({ isActive }) => isActive ? css.active : undefined}>PROJECTS</NavLink>
                                            </>
                                        );
                                    } else {
                                        return (
                                            <>
                                                <NavLink to={'files'} className={({ isActive }) => isActive ? css.active : undefined}>FILES REPOSITORY</NavLink>
                                                {data.getStudy.type === studyType.CLINICAL ?
                                                    <NavLink to={'data_management'} className={({ isActive }) => isActive ? css.active : undefined}>DATA MANAGEMENT</NavLink> : null}
                                                <NavLink to='projects' className={({ isActive }) => isActive ? css.active : undefined}>PROJECTS</NavLink>
                                            </>
                                        );
                                    }
                                }}
                            </Query >
                        </div >
                    </div >
                    <div className={css.content}>
                        <Routes>
                            <Route path='dashboard' element={<DashboardTabContent studyId={studyId} jobs={data.getStudy.jobs} />} />
                            <Route path='field_management' element={<FieldManagementTabContentFetch studyId={studyId} />} />
                            <Route path='data_management' element={<DataManagementTabContentFetch />} />
                            <Route path='files' element={<FileRepositoryTabContent studyId={studyId} />} />
                            <Route path='projects/*' element={<ProjectsTabContent projectList={data.getStudy.projects} />} />
                            <Route path='admin' element={<AdminTabContent />} />
                            <Route path='*' element={<Navigate to='dashboard' />} />
                        </Routes>
                    </div >
                </div >;
            }}
        </Query >
    );
};
