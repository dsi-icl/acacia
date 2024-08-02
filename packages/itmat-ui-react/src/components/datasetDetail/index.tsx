import { FunctionComponent } from 'react';
import { Query } from '@apollo/client/react/components';
import { NavLink, Route, Routes, useParams, Navigate } from 'react-router-dom';
import { WHO_AM_I } from '@itmat-broker/itmat-models';
import { IUserWithoutToken, enumUserTypes } from '@itmat-broker/itmat-types';
import LoadSpinner from '../reusable/loadSpinner';
import css from './projectPage.module.css';
import { DashboardTabContent, AdminTabContent } from './tabContent';
import { FileRepositoryTabContent } from './tabContent/files/fileTab';
import { trpc } from '../../utils/trpc';
import { ConfigTabContent } from './tabContent/config/configTab';

export const DatasetDetailPage: FunctionComponent = () => {
    const { studyId } = useParams();
    if (!studyId)
        return <LoadSpinner />;
    const getStudy = trpc.study.getStudies.useQuery({ studyId });

    if (getStudy.isLoading) {
        return <LoadSpinner />;
    }
    if (getStudy.isError) {
        return <>
            An error occured.
        </>;
    }
    if (getStudy.data.length === 0) {
        return <p>There is no dataset or you have not been granted access to any. Please contact your data custodian.</p>;
    }
    return <div className={css.page_container}>
        <div className={css.ariane}>
            <h2>{getStudy.data[0].name.toUpperCase()}</h2>
            <div className={css.tabs}>
                <Query<{ whoAmI: IUserWithoutToken }, never> query={WHO_AM_I}>
                    {({ loading, error, data: sessionData }) => {
                        if (loading) return <LoadSpinner />;
                        if (error) return <p>{error.toString()}</p>;
                        if (!sessionData) { return null; }
                        if (sessionData.whoAmI.type === enumUserTypes.ADMIN) {
                            return (
                                <>
                                    <NavLink to='config' className={({ isActive }) => isActive ? css.active : undefined}>CONFIG</NavLink>
                                    <NavLink to='dashboard' className={({ isActive }) => isActive ? css.active : undefined}>DASHBOARD</NavLink>
                                    <NavLink to='files' className={({ isActive }) => isActive ? css.active : undefined}>FILES REPOSITORY</NavLink>
                                    <NavLink to='admin' className={({ isActive }) => isActive ? css.active : undefined}>ADMINISTRATION</NavLink>
                                </>
                            );
                        } else {
                            return (
                                <NavLink to={'files'} className={({ isActive }) => isActive ? css.active : undefined}>FILES REPOSITORY</NavLink>
                            );
                        }
                    }}
                </Query >
            </div >
        </div >
        <div className={css.content}>
            <Routes>
                <Route path='config' element={<ConfigTabContent study={getStudy.data[0]} />} />
                <Route path='dashboard' element={<DashboardTabContent study={getStudy.data[0]} />} />
                <Route path='files' element={<FileRepositoryTabContent study={getStudy.data[0]} />} />
                <Route path='admin' element={<AdminTabContent />} />
                <Route path='*' element={<Navigate to='dashboard' />} />
            </Routes>
        </div >
    </div >;

};
