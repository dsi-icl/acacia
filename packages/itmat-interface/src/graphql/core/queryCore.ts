import mongodb from 'mongodb';
import { db } from '../../database/database';
import { permissions } from 'itmat-commons';
import { ApolloError } from 'apollo-server-core';
import { IProject, IStudy, IRole } from 'itmat-commons/dist/models/study';
import { errorCodes } from '../errors';
import uuidv4 from 'uuid/v4';
import { IUser, userTypes } from 'itmat-commons/dist/models/user';
import { IFieldEntry } from 'itmat-commons/dist/models/field';
import { IQueryEntry } from 'itmat-commons/dist/models/query';

export class QueryCore {
    async getOneQuery_throwErrorIfNotExists(queryId: string, onlyResult: boolean): Promise<IQueryEntry> {
        const queryEntry: IQueryEntry = await db.collections!.queries_collection.findOne({ id: queryId }, { projection: onlyResult ? { queryResult: 1 } : { _id: 0, claimedBy: 0 } })!;

        if (queryEntry === null || queryEntry === undefined) {
            throw new ApolloError('Query does not exist.', errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);
        }
        return queryEntry;
    }

    async createQuery(userId: string, queryString: string, studyId: string, projectId?: string): Promise<IQueryEntry> {
        const query: IQueryEntry = {
            requester: userId,
            id: uuidv4(),
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

    async getUsersQuery_NoResult(userId: string): Promise<IQueryEntry[]> {
        return db.collections!.queries_collection.find({ requester: userId }, { projection: { _id: 0, claimedBy: 0, queryResult: 0 } }).toArray();

    }

}

export const queryCore = Object.freeze(new QueryCore());