import { IJobEntry } from 'itmat-commons/dist/models/job';
import { GQLRequests } from 'itmat-commons';
import * as React from 'react';
import { InfoCircle } from '../../../reusable/infoCircle';
import * as css from './tabContent.module.css';
import { useSubscription } from 'react-apollo';

const STATUSES: { [status: string]: any } = {
    finished: () => <span className={css.finishedStatus_span}>Finished</span>,
    // error: (errors: string[]) => <><span className={css.errorStatus_span}>Errored</span><InfoCircle/></>,
    error: (errors: string[]) => <>
        <span className={css.errorStatus_span}>Errored</span>
        <InfoCircle/>
        <div className={css.error_wrapper}>
            <div>
                <ul>
                    {errors.map((el, ind) => <li key={ind}>{el}</li>)}
                </ul>
            </div>
        </div>
        </>,
    QUEUED: () => <span className={css.queuedStatus_span}>Queued</span>,
    PROCESSING: () => <span className={css.processingStatus_span}>Processing</span>,
    CANCELLED: () => <span className={css.cancelledStatus_span}>Cancelled</span>
};

const JOBTYPES: { [type: string]: any } = {
    DATA_UPLOAD: <span>Data upload</span>,
    FIELD_ANNOTATION_UPLOAD: <span>Field annotation upload</span>
};

export const JobSection: React.FunctionComponent<{ studyId: string, jobs: Array<IJobEntry<any>> }> = ({ studyId, jobs }) => {
    const { data, loading } = useSubscription(
        GQLRequests.SUBSCRIBE_TO_JOB_STATUS,
        { variables: { studyId }, onSubscriptionData: ({ client, subscriptionData})  => {
            console.log(subscriptionData);
        }}
    );
    return <div>
        {jobs === null || jobs.length === 0 ? <p>There has been no past jobs associated with this project.</p> :
            <table className={css.job_table}>
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Type</th>
                        <th>Status</th>
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
            <td className={css.status_td}>{job.cancelled ? STATUSES.CANCELLED() : (STATUSES[job.status] || (() => null))(job.error)}</td>
            <td>{JSON.stringify(job.data, null, 4)}</td>
            <td className={css.cancelButton}>x</td>
        </tr>
    );
};
