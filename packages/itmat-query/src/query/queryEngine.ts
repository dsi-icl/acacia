import mongodb from 'mongodb';
import { JobUtils } from '../utils/jobUtils';
import { Models, Logger } from 'itmat-utils';

export class QueryEngine {
    private jobUtils: JobUtils;

    constructor(private readonly dataCollection: mongodb.Collection, private readonly queryCollection: mongodb.Collection) {
        this.jobUtils = new JobUtils(this.queryCollection);
        this.processQuery = this.processQuery.bind(this);
    }

    public async processQuery(document: Models.Query.IQueryEntry): Promise<boolean> {
        if (document === undefined || document.queryString === undefined) {
            Logger.error(`Job ${document.id} does not have patientId, field or receivedFiles`);
            await this.jobUtils.setJobError(document.id, 'Does not have patientId, field or receivedFiles');
            return false;
        }

        let queryObj: any;
        try {
            queryObj = JSON.parse(document.queryString);
        } catch (e) {
            Logger.error('Cannot parse query obj.');
            this.jobUtils.setJobError(document.id, 'Cannot parse query obj.');
            console.log(e);
            return false;
        }

        const resultCursor = this.dataCollection.find(queryObj, { projection: { m_eid: 1, _id: 0 } });
        const result = await resultCursor.toArray();
        await this.queryCollection.updateOne({ id: document.id }, { $set: { queryResult: JSON.stringify(result)}});

        return true;
    }

}