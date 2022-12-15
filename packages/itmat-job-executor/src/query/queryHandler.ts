import { IJobEntry } from '@itmat-broker/itmat-types';
import { Logger } from '@itmat-broker/itmat-commons';
import { db } from '../database/database';
import { pipelineGenerator } from './pipeLineGenerator';
import { JobHandler } from '../jobHandlers/jobHandlerInterface';

export class QueryHandler extends JobHandler {
    private _instance?: QueryHandler;
    // private ukbCurator: UKBCurator;

    public async getInstance() {
        if (!this._instance) {
            this._instance = new QueryHandler();
        }
        return this._instance;
    }

    public async execute(job: IJobEntry<{ queryId: string[], projectId: string, studyId: string }>) {
        // get available data versions
        const thisProject = await db.collections!.projects_collection.findOne({ id: job.data?.projectId });
        const availableDataVersions = [thisProject!.dataVersion];
        const queryId = job.data?.queryId[0];
        const queryString = await db.collections!.queries_collection.findOne({ id: queryId })!;
        const pipeline = pipelineGenerator.buildPipeline(queryString!.queryString, job.studyId, availableDataVersions);
        if (!pipeline) {
            /* update query status */
            await db.collections!.queries_collection.findOneAndUpdate({ queryId }, {
                $set: {
                    error: 'Pipeline was not generated properly',
                    status: 'FINISHED WITH ERROR'
                }
            });
            return;
        }
        try {
            const result = await db.collections!.data_collection.aggregate(pipeline).toArray();
            /* if the query is on a project, then we need to map the results m_eid */
            if (job.projectId) {
                const project = await db.collections!.projects_collection.findOne({ id: job.data?.projectId })!;
                if (project === null || project === undefined) {
                    await db.collections!.queries_collection.findOneAndUpdate({ queryId }, {
                        $set: {
                            error: 'Project does not exist or has been deleted.',
                            status: 'FINISHED WITH ERROR'
                        }
                    });
                    return;
                }
                const mapping = project.patientMapping;
                result.forEach((el) => {
                    if (el.m_eid === undefined) { return; }
                    el.m_eid = mapping[el.m_eid];
                });
            }
            await db.collections!.queries_collection.findOneAndUpdate({ id: queryId }, {
                $set: {
                    queryResult: JSON.stringify(result),
                    status: 'FINISHED'
                }
            });
            await db.collections!.jobs_collection.updateOne({ id: job.id }, { $set: { status: 'finished' } });
            return;
        } catch (e: any) {
            /* log */
            Logger.error(e.toString());

            /* update query status */
            await db.collections!.queries_collection.findOneAndUpdate({ queryId }, {
                $set: {
                    error: e.toString(),
                    status: 'FINISHED WITH ERROR'
                }
            });
            return;
        }
    }


}
