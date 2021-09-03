import { GQLRequests } from 'itmat-commons';
import * as React from 'react';
import { InfoCircle } from '../../../reusable/icons/infoCircle';
import css from './tabContent.module.css';
import { useSubscription } from '@apollo/client/react/hooks';
import { GET_STUDY, IJobEntry } from 'itmat-commons';

const STATUSES: { [status: string]: any } = {
    finished: () => <td className={css.finishedStatus_td}><span>Finished</span></td>,
    // error: (errors: string[]) => <><span className={css.errorStatus_span}>Errored</span><InfoCircle/></>,
    error: (errors: string[]) => <td className={css.errorStatus_td}>
        <span>Errored</span>
        <InfoCircle />
        <div className={css.error_wrapper}>
            <div>
                <ul>
                    {errors.map((el, ind) => <li key={ind}>{el}</li>)}
                </ul>
            </div>
        </div>
    </td>,
    QUEUED: () => <td className={css.queuedStatus_td}><span>Queued</span></td>,
    PROCESSING: () => <td className={css.processingStatus_td}><span>Processing</span></td>,
    CANCELLED: () => <td className={css.cancelledStatus_td}><span>Cancelled</span></td>
};

const JOBTYPES: { [type: string]: any } = {
    DATA_UPLOAD_CSV: <span>Data upload</span>,
    DATA_UPLOAD_JSON: <span>Data upload json</span>,
    FIELD_INFO_UPLOAD: <span>Field annotation upload</span>
};

export const JobSection: React.FunctionComponent<{ studyId: string; jobs: Array<IJobEntry<any>> }> = ({ studyId, jobs }) => {
    useSubscription(
        GQLRequests.SUBSCRIBE_TO_JOB_STATUS,
        {
            variables: { studyId }, onSubscriptionData: ({ client: store, subscriptionData }) => {
                const olddata: any = store.readQuery({ query: GET_STUDY, variables: { studyId } });
                const oldjobs = olddata.getStudy.jobs;
                const newjobs = oldjobs.map((el: any) => {
                    if (el.id === subscriptionData.data.subscribeToJobStatusChange.jobId) {
                        el.status = subscriptionData.data.subscribeToJobStatusChange.newStatus;
                        if (el.status === 'error') {
                            el.error = subscriptionData.data.subscribeToJobStatusChange.errors;
                        }
                    }
                    return el;
                });
                olddata.getStudy.jobs = newjobs;
                store.writeQuery({ query: GET_STUDY, variables: { studyId }, data: olddata });
            }
        }
    );
    return <div>
        {jobs === null || jobs.length === 0 ? <p>There has been no past jobs associated with this project.</p> :
            <table className={css.job_table}>
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Type</th>
                        <th></th>
                        <th>Metadata</th>
                        <th>Cancel</th>
                    </tr>
                </thead>
                <tbody>
                    {jobs.map((el) => <OneJob key={el.id} job={el} />)}
                </tbody>
            </table>
        }
    </div>;
};

const OneJob: React.FunctionComponent<{ job: IJobEntry<any> }> = ({ job }) => {
    return (
        <tr>
            <td>{new Date(job.requestTime).toLocaleString()}</td>
            <td>{JOBTYPES[job.jobType]}</td>
            {job.cancelled ? STATUSES.CANCELLED() : (STATUSES[job.status] || (() => null))(job.error)}
            <td>{JSON.stringify(job.data, null, 4)}</td>
            <td className={css.cancelButton}>x</td>
        </tr>
    );
};
