import { FunctionComponent } from 'react';
import { InfoCircleOutlined } from '@ant-design/icons';
import css from './tabContent.module.css';
import { useSubscription } from '@apollo/client/react/hooks';
import type { IJobEntry } from '@itmat-broker/itmat-types';
import { GET_STUDY, SUBSCRIBE_TO_JOB_STATUS } from '@itmat-broker/itmat-models';
import { Table, Button } from 'antd';

const STATUSES: { [status: string]: any } = {
    finished: () => <td className={css.finishedStatus_td}><span>Finished</span></td>,
    // error: (errors: string[]) => <><span className={css.errorStatus_span}>Errored</span><InfoCircle/></>,
    error: (errors: string[]) => <td className={css.errorStatus_td}>
        <span>Errored</span>
        <InfoCircleOutlined />
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

// const JOBTYPES: { [type: string]: any } = {
//     DATA_UPLOAD_CSV: <span>Data upload</span>,
//     DATA_UPLOAD_JSON: <span>Data upload json</span>,
//     FIELD_INFO_UPLOAD: <span>Field annotation upload</span>
// };

export const JobSection: FunctionComponent<{ studyId: string; jobs: Array<IJobEntry<any>> }> = ({ studyId, jobs }) => {
    useSubscription(
        SUBSCRIBE_TO_JOB_STATUS,
        {
            variables: { studyId }, onSubscriptionData: ({ client: store, subscriptionData }) => {
                if (subscriptionData.data.subscribeToJobStatusChange !== null) {
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
                    const tmp = { ...olddata.getStudy, jobs: newjobs };
                    store.writeQuery({ query: GET_STUDY, variables: { studyId }, data: { getStudy: tmp } });
                }
            }
        }
    );
    const columns = [
        {
            title: 'Created At',
            dataIndex: 'requestTime',
            key: 'requestTime',
            render: (__unused__value, record) => {
                return new Date(record.requestTime).toUTCString();
            }
        },
        {
            title: 'Job Type',
            dataIndex: 'jobType',
            key: 'jobType',
            render: (__unused__value, record) => {
                return record.jobType;
            }
        },
        {
            title: 'Parameters',
            dataIndex: 'parameters',
            key: 'parameters',
            render: (__unused__value, record) => {
                return record.receivedFiles;
            }
        },
        {
            title: 'Status',
            dataIndex: 'status',
            key: 'status',
            render: (__unused__value, record) => {
                return record.cancelled ? STATUSES.CANCELLED() : (STATUSES[record.status] || (() => null))(record.error);
            }
        },
        {
            title: 'Cancel',
            dataIndex: 'cancel',
            key: 'cancel',
            render: () => {
                return (<Button type='primary' htmlType='submit'
                // onClick={() => {}}
                >
                    Cancel
                </Button>);
            }
        }
    ];

    return (<div>
        <Table
            rowKey={(rec) => rec.id}
            columns={columns}
            dataSource={jobs}
            size='small'
            pagination={
                {
                    defaultPageSize: 50,
                    showSizeChanger: true,
                    pageSizeOptions: ['20', '50', '100', '200'],
                    defaultCurrent: 1,
                    showQuickJumper: true
                }
            }
        >
        </Table>
    </div>);

};
