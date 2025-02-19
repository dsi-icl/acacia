import { CoreError, IJob, enumCoreErrors, enumJobType, enumJobStatus, IExecutor} from '@itmat-broker/itmat-types';
import { v4 as uuid } from 'uuid';
import { DBType } from '../database/database';


export class JobCore {
    db: DBType;
    constructor(db: DBType) {
        this.db = db;
    }

    /**
     * Create a job.
     *
     * @param requester - The ID of the requester creating the job.
     * @param name - The name of the job.
     * @param type - The type of the job (enumJobType).
     * @param nextExecutionTime - When the job should start. Null for immediate execution.
     * @param period - The period for recurring jobs.
     * @param executor - The executor responsible for running the job.
     * @param data - Any input data required for the job.
     * @param parameters - Additional parameters for the job.
     * @param priority - The job's priority level.
     * @param metadata - Additional metadata for the job.
     *
     * @return IJobEntry
     */
    public async createJob(
        requester: string,
        name: string,
        type: enumJobType,
        nextExecutionTime?: number,
        period?: number,
        executor?: IExecutor,
        data?: JSON | null | undefined,
        parameters?: JSON | null | undefined,
        priority?: number,
        metadata?: Record<string, unknown>
    ): Promise<IJob> {
        const jobEntry: IJob = {
            id: uuid(),
            name: name,
            nextExecutionTime: nextExecutionTime ?? Date.now(),
            period: period ?? null,
            type: type,
            executor: executor ?? null,
            data: data ?? null,
            parameters: parameters ?? null,
            priority: priority ?? 0,
            status: enumJobStatus.PENDING,
            history: [],
            counter: 0,
            life: {
                createdTime: Date.now(),
                createdUser: requester,
                deletedTime: null,
                deletedUser: null
            },
            metadata: metadata ?? {}
        };

        await this.db.collections.jobs_collection.insertOne(jobEntry);
        return jobEntry;
    }

    /**
 * Retrieve jobs based on optional filters.
 *
 * @param filter - Partial filter to query jobs (e.g., by name, type, status).
 *
 * @return IJobEntry[]
 */
    public async getJobs(filter: Partial<IJob> = {}) {
        return await this.db.collections.jobs_collection.find(filter).toArray();
    }

    /**
 * Edit an existing job by updating its priority, next execution time, or period.
 *
 * @param requester - The ID of the user requesting the edit.
 * @param jobId - The ID of the job to edit.
 * @param priority - New priority value (optional).
 * @param nextExecutionTime - New next execution time (optional).
 * @param period - New period for recurring jobs (optional).
 *
 * @return IJobEntry
 */
    public async editJob(
        requester: string,
        jobId: string,
        priority?: number | null,
        nextExecutionTime?: number | null,
        period?: number | null
    ): Promise<IJob> {
        const job = await this.db.collections.jobs_collection.findOne({ id: jobId });

        if (!job) {
            throw new CoreError(
                enumCoreErrors.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY,
                'Job does not exist.'
            );
        }

        const setObj: Partial<IJob> = {};
        if (priority !== undefined && priority !== null) {
            setObj.priority = priority;
        }
        if (nextExecutionTime !== undefined && nextExecutionTime !== null) {
            setObj.nextExecutionTime = nextExecutionTime;
            setObj.status = enumJobStatus.PENDING;
        }
        if (period !== undefined) {
            setObj.period = period;
        }

        const result = await this.db.collections.jobs_collection.findOneAndUpdate(
            { id: jobId },
            { $set: setObj },
            { returnDocument: 'after' }
        );

        if (!result) {
            throw new CoreError(
                enumCoreErrors.DATABASE_ERROR,
                'Failed to update the job.'
            );
        }

        return result;
    }

    /**
 * Get a job based on specific filters, like job ID, name, type, status, etc.
 *
 * @param filter - The filter for querying jobs.
 *
 * @return IJobEntry[]
 */
    public async getJob(filter: Partial<IJob>) {
        return await this.db.collections.jobs_collection.find(filter).toArray();
    }

}
