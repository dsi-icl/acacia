import * as React from 'react';
import { Query } from '@apollo/client/react/components';
import { NavLink, Route, Switch } from 'react-router-dom';
import { GET_STUDY, WHO_AM_I, userTypes, studyType } from 'itmat-commons';
import LoadSpinner from '../reusable/loadSpinner';
import css from './projectPage.module.css';
import { DashboardTabContent, DataManagementTabContentFetch, ProjectsTabContent, AdminTabContent } from './tabContent';
import { FileRepositoryTabContent } from './tabContent/files/fileTab';

export const DatasetDetailPage: React.FunctionComponent<{ studyId: string }> = ({ studyId }) => {
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
                if (error) { return <p>Error :( {JSON.stringify(error)}</p>; }
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
                                                <NavLink to={`/datasets/${studyId}/dashboard`} activeClassName={css.active}>DASHBOARD</NavLink>
                                                <NavLink to={`/datasets/${studyId}/data_management`} activeClassName={css.active}>DATA MANAGEMENT</NavLink>
                                                <NavLink to={`/datasets/${studyId}/files`} activeClassName={css.active}>FILES REPOSITORY</NavLink>
                                                <NavLink to={`/datasets/${studyId}/admin`} activeClassName={css.active}>ADMINISTRATION</NavLink>
                                                <NavLink to={`/datasets/${studyId}/projects`} activeClassName={css.active}>PROJECTS</NavLink>
                                            </>
                                        );
                                    } else {
                                        return (
                                            <>
                                                <NavLink to={`/datasets/${studyId}/files`} activeClassName={css.active}>FILES REPOSITORY</NavLink>
                                                {data.getStudy.type === studyType.CLINICAL ?
                                                    <NavLink to={`/datasets/${studyId}/data_management`} activeClassName={css.active}>DATA MANAGEMENT</NavLink> : null}
                                            </>
                                        );
                                    }
                                }}
                            </Query>
                        </div>
                    </div>
                    <div className={css.content}>
                        <Switch>
                            <Route path='/datasets/:studyId/dashboard' render={() => <DashboardTabContent studyId={studyId} jobs={data.getStudy.jobs} />} />
                            <Route path='/datasets/:studyId/data_management' render={({ match }) => <DataManagementTabContentFetch studyId={match.params.studyId} />} />
                            <Route path='/datasets/:studyId/files' render={() => <FileRepositoryTabContent studyId={studyId} />} />
                            <Route path='/datasets/:studyId/projects' render={({ match }) => <ProjectsTabContent studyId={match.params.studyId} projectList={data.getStudy.projects} />} />
                            <Route path='/datasets/:studyId/admin' component={AdminTabContent} />
                            <Route path='/datasets/:studyId/' render={() => <></>} />
                        </Switch>
                    </div>
                </div>;
            }}
        </Query>
    );
};
