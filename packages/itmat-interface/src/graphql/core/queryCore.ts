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

    public async getQueries(studyId: string, projectId): Promise<IQueryEntry[]> {
        const queryEntry = await db.collections!.queries_collection.find({ studyId: studyId, projectId: projectId });

        if (queryEntry === null || queryEntry === undefined) {
            throw new ApolloError('Query does not exist.', errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);
        }
        return queryEntry.toArray();
    }

    public async createQuery(args: any): Promise<IQueryEntry> {
        const query: IQueryEntry = {
            requester: args.query.userId,
            id: uuid(),
            queryString: args.query.queryString,
            studyId: args.query.studyId,
            projectId: args.query.projectId,
            status: 'QUEUED',
            error: null,
            cancelled: false,
            data_requested: JSON.parse(args.query.queryString).data_requested,
            cohort: JSON.parse(args.query.queryString).cohort,
            new_fields: JSON.parse(args.query.queryString).new_fields
        };
        await db.collections!.queries_collection.insertOne(query);
        return query;
    }

    public async getUsersQuery_NoResult(userId: string): Promise<IQueryEntry[]> {
        return db.collections!.queries_collection.find<IQueryEntry>({ requester: userId }, { projection: { _id: 0, claimedBy: 0, queryResult: 0 } }).toArray();

    }

}

export const queryCore = Object.freeze(new QueryCore());
