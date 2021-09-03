import { IQueryEntry, IProject, Logger } from 'itmat-commons';
import { db } from '../database/database';
import { pipelineGenerator } from './pipeLineGenerator';

class QueryHandler {
    public async actOnDocument(document: IQueryEntry): Promise<void> {
        const { id } = document;
        const pipeline = pipelineGenerator.buildPipeline(document);
        try {
            const result = await db.collections!.data_collection.aggregate(pipeline).toArray();

            /* if the query is on a project, then we need to map the results m_eid */
            if (document.projectId) {
                const project: IProject = await db.collections!.projects_collection.findOne({ id: document.projectId })!;
                if (project === null || project === undefined) {
                    await db.collections!.queries_collection.findOneAndUpdate({ id }, { $set: {
                        error: 'Project does not exist or has been deleted.',
                        status: 'FINISHED WITH ERROR'
                    }});
                    return;
                }
                const mapping = project.patientMapping;
                result.forEach((el) => {
                    if (el.m_eid === undefined) { return; }
                    el.m_eid = mapping[el.m_eid];
                });
            }

            await db.collections!.queries_collection.findOneAndUpdate({ id }, { $set: {
                queryResult: JSON.stringify(result),
                status: 'FINISHED'
            }});
            return;
        } catch (e) {
            /* log */
            Logger.error(e.toString());

            /* update query status */
            await db.collections!.queries_collection.findOneAndUpdate({ id }, { $set: {
                error: e.toString(),
                status: 'FINISHED WITH ERROR'
            }});
            return;
        }
    }
}

export const queryHandler = new QueryHandler();
