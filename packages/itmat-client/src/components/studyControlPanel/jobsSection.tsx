import * as React from 'react';
import { Models } from 'itmat-utils';

const Job: React.FunctionComponent<{ job: Models.JobModels.IJobEntry<any> }> = ({ job }) => {
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
}

export const JobSection: React.FunctionComponent<{ data: Models.JobModels.IJobEntry<any>[] }> = ({ data }) => {
    return (
        <div>
        <h3>Past jobs</h3>
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
                {data.map(el => <Job key={el.id} job={el}/>)}
            </tbody>
        </table>
    </div>
    );
}