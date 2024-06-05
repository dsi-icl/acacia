import { IProject, IQueryEntry, IUserWithoutToken } from '@itmat-broker/itmat-types';
import { v4 as uuid } from 'uuid';
import { GraphQLError } from 'graphql';
import { errorCodes } from '../utils/errors';
import { DBType } from '../database/database';
import { PermissionCore } from './permissionCore';

export class QueryCore {
    db: DBType;
    permissionCore: PermissionCore;
    constructor(db: DBType) {
        this.db = db;
        this.permissionCore = new PermissionCore(db);
    }

    public async getQueryByIdparent(requester: IUserWithoutToken | undefined, queryId: string) {
        if (!requester) {
            throw new GraphQLError(errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);
        }
        /* check query exists */
        const queryEntry = await this.db.collections.queries_collection.findOne({ id: queryId }, { projection: { _id: 0, claimedBy: 0 } });
        if (queryEntry === null || queryEntry === undefined) {
            throw new GraphQLError('Query does not exist.', { extensions: { code: errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY } });
        }
        /* check permission */
        const roles = await this.permissionCore.getRolesOfUser(requester, queryEntry.studyId);
        if (!roles.length) {
            throw new GraphQLError(errorCodes.NO_PERMISSION_ERROR);
        }
        return queryEntry;
    }

    public async getQueries(requester: IUserWithoutToken | undefined, studyId: string, projectId: string) {
        if (!requester) {
            throw new GraphQLError(errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);
        }
        /* check permission */
        const roles = await this.permissionCore.getRolesOfUser(requester, studyId);
        if (!roles.length) { throw new GraphQLError(errorCodes.NO_PERMISSION_ERROR); }
        const entries = await this.db.collections.queries_collection.find({ studyId: studyId, projectId: projectId }).toArray();
        return entries;
    }

    public async createQuery(userId: string, queryString, studyId: string, projectId?: string): Promise<IQueryEntry> {
        /* check study exists */
        const studySearchResult = await this.db.collections.studies_collection.findOne({ id: studyId, deleted: null });
        if (studySearchResult === null || studySearchResult === undefined) {
            throw new GraphQLError('Study does not exist.', { extensions: { code: errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY } });
        }
        /* check project exists */
        const project = await this.db.collections.projects_collection.findOne<Omit<IProject, 'patientMapping'>>({ id: projectId, deleted: null }, { projection: { patientMapping: 0 } });
        if (project === null) {
            throw new GraphQLError(errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);
        }
        /* check project matches study */
        if (studySearchResult.id !== project.studyId) {
            throw new GraphQLError('Study and project mismatch.', { extensions: { code: errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY } });
        }
        const query: IQueryEntry = {
            requester: userId,
            id: uuid(),
            queryString: queryString,
            studyId: studyId,
            projectId: projectId,
            status: 'QUEUED',
            error: null,
            cancelled: false,
            data_requested: queryString.data_requested,
            cohort: queryString.cohort,
            new_fields: queryString.new_fields
        };
        await this.db.collections.queries_collection.insertOne(query);
        return query;
    }

    public async getUsersQuery_NoResult(userId: string): Promise<IQueryEntry[]> {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        //@ts-ignore
        return db.collections.queries_collection.find<IQueryEntry>({ requester: userId }, { projection: { _id: 0, claimedBy: 0, queryResult: 0 } }).toArray();
    }

}

