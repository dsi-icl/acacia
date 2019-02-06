import * as React from 'react';
import { Query, Subscription } from "react-apollo";
import { GET_STUDIES } from '../../graphql/study';
import { SUBSCRIPTION_NEW_APPLICATION } from '../../graphql/studyDetails';
import { Route, Switch } from 'react-router-dom';
import * as css from '../../css/studyControl.module.css';
import { Models } from 'itmat-utils';
import { ApplicationListSection } from './applications/applicationsList';
import { JobSection } from './jobsSection';
import { ExportSection } from './exportSection';
import { CurationSection } from './curationSection';
import { AddOrDeleteShortCut } from './addShortCut';
import { AddApplication, ApplicationDetails } from './applications';
import { ClinicalDataCurationUKBSection } from '../curation/clinicalDataUKB';
import { StudyManagersSections } from './studyManagers';
import { DeleteStudyButton, ReallyDeleteStudy } from './deleteStudy';

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
    const [successfullyDeleted, setSuccessfullyDeleted] = React.useState(false);

    if (successfullyDeleted) return <p>{`Study ${name} has been successfully deleted.`}</p>;

    return (
        <Query query={GET_STUDIES} variables={{ name }}>
            {({ loading, error, data, subscribeToMore }) => {
                if (loading) return null;
                if (error) return `Error!: ${error.message}`;
                console.log(data);
                const study: Models.Study.IStudy & { jobs: Models.JobModels.IJobEntry<any>[] } = data.getStudies[0];
                if (study === undefined || study === null) { return `Cannot find study "${name}"`; }

                return (
                    <div className={css.studyControl}>
                        <div className={css.studyDashboard}>
                            <div><h1>{name}</h1></div>
                            <DeleteStudyButton studyName={name}/>
                            <AddOrDeleteShortCut studyName={name}/>
                            {/* <StudyManagersSections listOfManagers={study.studyAndDataManagers} studyName={name}/> */}
                            <ApplicationListSection
                                studyName={name}
                                list={study.applications}
                                subscribeToNewApplication={() => {
                                    subscribeToMore({
                                        document: SUBSCRIPTION_NEW_APPLICATION,
                                        variables: { name: name },
                                        updateQuery: (prev, { subscriptionData }) => {
                                            console.log(prev, subscriptionData);
                                            if (!subscriptionData.data || !subscriptionData.data.newApplicationCreated) return prev;
                                            prev.getStudies[0].applications.push(subscriptionData.data.newApplicationCreated);
                                            return prev;
                                        }
                                    })
                                }}
                            />
                            <JobSection data={study.jobs}/>
                            <CurationSection studyName={name}/>
                            {/* <ExportSection/> */}
                        </div>
                        <div className={css.extraActionPanel}>
                            <Switch>
                                <Route path='/studies/details/:studyName/application/addNewApplication' render={({ match }) => <AddApplication studyName={match.params.studyName}/>}/>
                                <Route path='/studies/details/:studyName/application/:applicationName' render={({ match }) => <ApplicationDetails studyName={match.params.studyName} applicationName={match.params.applicationName}/>}/>
                                <Route path='/studies/details/:studyName/curation/uploadData' render={({ match }) => <ClinicalDataCurationUKBSection studyName={match.params.studyName}/>}/>
                                <Route path='/studies/details/:studyName/delete' render={({ match }) => <ReallyDeleteStudy setDeletedStateHandler={setSuccessfullyDeleted} studyName={match.params.studyName}/>}/>
                                <Route path='/studies/details/:studyName' render={({ match }) => <></>}/>
                            </Switch>
                        </div>
                        

                    </div>
                );
            }}
        </Query>
    );
};

