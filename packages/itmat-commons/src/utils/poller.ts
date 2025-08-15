import type * as mongodb from 'mongodb';
import { enumJobHistoryStatus, enumJobStatus, IJob, IJobPollerConfig, IJobSchedulerConfig, IJobActionReturn } from '@itmat-broker/itmat-types';
import { Logger } from './logger';

export class JobPoller {
    private intervalObj?: NodeJS.Timer;
    private readonly matchObj: unknown;

    private readonly identity: string;
    private readonly jobType?: string;
    private readonly jobCollection: mongodb.Collection<IJob>;
    private readonly pollingInterval: number;
    private readonly action: (document: IJob) => Promise<IJobActionReturn>;
    private readonly jobScheduler: JobScheduler;
    private readonly jobSchedulerConfig: IJobSchedulerConfig;

    constructor(config: IJobPollerConfig) {
        this.identity = config.identity;
        this.jobType = config.jobType;
        this.jobCollection = config.jobCollection;
        this.pollingInterval = config.pollingInterval;
        this.action = config.action;
        this.setInterval = this.setInterval.bind(this);
        this.checkForJobs = this.checkForJobs.bind(this);

        this.jobScheduler = new JobScheduler({
            ...config.jobSchedulerConfig,
            jobCollection: config.jobCollection
        });
        this.jobSchedulerConfig = config.jobSchedulerConfig;

    }

    public setInterval(): void {
        this.intervalObj = setInterval(() => {
            void this.checkForJobs(this.jobSchedulerConfig); // Wrap the async call
        }, this.pollingInterval);
    }

    private async checkForJobs(config: IJobSchedulerConfig){
        let job: IJob | null;
        try {
            // implement the scheduler here
            job = await this.jobScheduler.findNextJob();
        } catch (err) {
            Logger.error(`${this.identity} Errored picking up a job: ${err}`);
            return;
        }
        if (job) {
            // update log status
            const setObj: mongodb.UpdateFilter<IJob> = {};
            try {

                const result = await this.action(job);
                // Logger.log(`[JOB] Job Execution finished: ${new Date((Date.now())).toISOString()}, ${JSON.stringify(result?.error)}, ${JSON.stringify(result)}`);

                if (job.period) {
                    setObj['status'] = enumJobStatus.PENDING;
                    setObj['nextExecutionTime'] = Date.now() + job.period;
                }
                let newHistoryEntry;
                if (result) {
                    if (!result.successful) {
                        newHistoryEntry = {
                            time: Date.now(),
                            status: enumJobHistoryStatus.FAILED,
                            errors: [result.error]
                        };
                        // update the job status to failed if not periodic
                        // if periodic, keep it pending, else if oneoff, set it to error
                        setObj['status'] = job.period ? enumJobStatus.PENDING : enumJobStatus.ERROR;

                        // if the job has failed and  it's not period, counter less than maxAttempts, set the job nextExecutionTime to now + failedJobDelayTime
                        if (!job.period && job.counter < config.maxAttempts) {
                            setObj['nextExecutionTime'] = Date.now() + config.failedJobDelayTime;
                        }

                    } else {
                        newHistoryEntry = {
                            time: Date.now(),
                            status: enumJobHistoryStatus.SUCCESS,
                            result: result.result ? [result.result] : []
                        };
                        // update the job status to success
                        // numJobStatus.FINISHED if !job.period else enumJobStatus.PENDING;
                        setObj['status'] = job.period ? enumJobStatus.PENDING : enumJobStatus.FINISHED;
                    }
                }
                setObj['counter'] = job.counter + 1;

                const jobUpdate = await this.jobCollection.findOne({ id: job.id });
                if (jobUpdate) {
                    const currentHistory = jobUpdate.history || [];
                    setObj['history'] = [...currentHistory];
                    if (newHistoryEntry) {
                        setObj['history'].push(newHistoryEntry);
                    }
                    await this.jobCollection.findOneAndUpdate({ id: job.id }, {
                        $set: setObj
                    });
                }
            } catch (error) {
                const currentHistory = job.history || [];
                setObj['history'] = [...currentHistory, {
                    time: Date.now(),
                    status: enumJobHistoryStatus.FAILED,
                    errors: [error]
                }];
                await this.jobCollection.findOneAndUpdate({ id: job.id }, {
                    $set: setObj
                });

            }
        }
    }
}

export class JobScheduler {
    private config: Required<IJobSchedulerConfig>;
    constructor(config: Required<IJobSchedulerConfig>) {
        this.config = config;
    }

    public async findNextJob() {
        let availableJobs = await this.config.jobCollection.find({
            status: { $in: [enumJobStatus.PENDING] }
        }).toArray();
        // we sort jobs based on the config
        availableJobs = availableJobs.filter(el => {
            // If the job has a non-null period, it should always be included
            if (el.period !== null) {
                return true;
            }
            // ERROR jobs are always included
            if (this.config.reExecuteFailedJobs && el.history.filter(ek => ek.status === enumJobHistoryStatus.FAILED).length > this.config.maxAttempts) {
                return false;
            }
            if (Date.now() < el.nextExecutionTime) {
                return false;
            }
            return true;
        });


        // Sort jobs based on the config
        availableJobs = availableJobs.sort((a, b) => {
            if (this.config.usePriority) {
                if (a.priority !== b.priority) {
                    return b.priority - a.priority; // Higher priority first
                } else {
                    return a.nextExecutionTime - b.nextExecutionTime; // Earlier execution time first
                }
            } else {
                return a.nextExecutionTime - b.nextExecutionTime; // Earlier execution time first
            }
        });


        const job = availableJobs[0];
        if (!job) {
            return null;
        }


        // Update nextExecutionTime for periodic jobs
        if (job.period !== null) {
            job.nextExecutionTime = Date.now() + job.period;
            await this.config.jobCollection.updateOne({ _id: job._id }, { $set: { nextExecutionTime: job.nextExecutionTime, status: enumJobStatus.PENDING } });
        }
        return job;
    }
}