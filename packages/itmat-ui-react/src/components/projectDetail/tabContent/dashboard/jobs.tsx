import { FunctionComponent } from 'react';
import { IJobEntry } from '@itmat-broker/itmat-types';

export const JobSection: FunctionComponent<{ jobs: Array<IJobEntry<any>> }> = ({ jobs }) => {
    return <div>
        {jobs === null || jobs.length === 0 ? <p>There has been no past jobs associated with this project.</p> :
            <table>
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Type</th>
                        <th>Requested by</th>
                        <th>Received files</th>
                        <th>Status</th>
                        <th>Metadata</th>
                    </tr>
                </thead>
                <tbody>
                    {jobs.map((el) => <OneJob key={el.id} job={el} />)}
                </tbody>
            </table>
        }
    </div>;
};

const OneJob: FunctionComponent<{ job: IJobEntry<any> }> = ({ job }) => {
    return (
        <tr>
            <td></td>
            <td>{job.jobType}</td>
            <td>{job.requester}</td>
            <td>{job.receivedFiles}</td>
            <td>{job.status}</td>
            <td>{JSON.stringify(job.data)}</td>
        </tr>
    );
};
