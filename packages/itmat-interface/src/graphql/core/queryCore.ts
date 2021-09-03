import { ApolloError } from 'apollo-server-core';
import { IQueryEntry } from 'itmat-commons';
import { v4 as uuid } from 'uuid';
import { db } from '../../database/database';
import { errorCodes } from '../errors';

export class QueryCore {
    public async getOneQuery_throwErrorIfNotExists(queryId: string, onlyResult: boolean): Promise<IQueryEntry> {
        const queryEntry = await db.collections!.queries_collection.findOne<IQueryEntry>({ id: queryId }, { projection: onlyResult ? { queryResult: 1 } : { _id: 0, claimedBy: 0 } })!;

        if (queryEntry === null || queryEntry === undefined) {
            throw new ApolloError('Query does not exist.', errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);
        }
        return queryEntry;
    }

    public async createQuery(userId: string, queryString: string, studyId: string, projectId?: string): Promise<IQueryEntry> {
        const query: IQueryEntry = {
            requester: userId,
            id: uuid(),
            queryString,
            studyId,
            projectId,
            status: 'QUEUED',
            error: null,
            cancelled: false,
            data_requested: JSON.parse(queryString).data_requested,
            cohort: JSON.parse(queryString).cohort,
            new_fields: JSON.parse(queryString).new_fields
        };
        await db.collections!.queries_collection.insertOne(query);
        return query;
    }

    public async getUsersQuery_NoResult(userId: string): Promise<IQueryEntry[]> {
        return db.collections!.queries_collection.find<IQueryEntry>({ requester: userId }, { projection: { _id: 0, claimedBy: 0, queryResult: 0 } }).toArray();

    }

}

export const queryCore = Object.freeze(new QueryCore());
