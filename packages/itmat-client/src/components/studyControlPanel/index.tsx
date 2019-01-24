import * as React from 'react';
import { Query } from "react-apollo";
import { GET_STUDIES } from '../../graphql/study';
import { Route, Switch } from 'react-router-dom';
import * as css from '../../css/studyControl.module.css';
import { Models } from 'itmat-utils';
import { ApplicationListSection } from './applications/applicationsList';
import { JobSection } from './jobsSection';
import { ExportSection } from './exportSection';
import { CurationSection } from './curationSection';
import { AddShortCut } from './addShortCut';
import { AddApplication, ApplicationDetails } from './applications';
import { ClinicalDataCurationUKBSection } from '../curation/clinicalDataUKB';
/**
 * Sections:
 * Data update log
 * Data managers
 * Applications
 *      - application admin
 *      - application user
 *      - pending user
 *      - approvedFields
 * Jobs
 * Export
 * Curation
 */

export const StudyControl: React.FunctionComponent<{ name: string }> = ({ name }) => {
    return (
        <Query query={GET_STUDIES} variables={{ name }}>
            {({ loading, error, data }) => {
                if (loading) return null;
                if (error) return `Error!: ${error.message}`;

                const study: Models.Study.IStudy & { jobs: Models.JobModels.IJobEntry<any>[] } = data.getStudies[0];
                if (study === undefined || study === null) { return `Cannot find study "${name}"`; }

                return (
                    <div className={css.studyControl}>
                        <div className={css.leftPanel}>
                        <Switch>
                            <Route path='/studies/details/:studyName' render={({ match }) => <> 
                                <GenericListSection title='Study Managers' list={study.studyAndDataManagers} mapfunc={(el: string) => <p key={el}>{el}</p>} />
                                <ApplicationListSection studyName={match.params.studyName} list={study.applications}/>
                                <JobSection data={study.jobs}/>
                                <CurationSection studyName={match.params.studyName}/>
                                <ExportSection/>
                                <AddShortCut/>
                            </>}/>
                        </Switch>
                        </div>
                        <div className={css.rightPanel}>
                        <Switch>
                            <Route path='/studies/details/:studyName/application/addNewApplication' render={({ match }) => <AddApplication studyName={match.params.studyName}/>}/>
                            <Route path='/studies/details/:studyName/application/:applicationName' render={({ match }) => <ApplicationDetails studyName={match.params.studyName} applicationName={match.params.applicationName}/>}/>
                            <Route path='/studies/details/:studyName/curation/uploadData' render={({ match }) => <ClinicalDataCurationUKBSection studyName={match.params.studyName}/>}/>
                            <Route path='/studies/details/:studyName' render={({ match }) => <></>}/>
                        </Switch>
                        </div>
                        

                    </div>
                );
            }}
        </Query>
    );
};

const GenericListSection: React.FunctionComponent<{ title: String, list: any[], mapfunc: Function }> = ({title, list, mapfunc}) =>
    <div>
        <h3>{title}</h3>
        {list.map(mapfunc as any)}
    </div>
;


