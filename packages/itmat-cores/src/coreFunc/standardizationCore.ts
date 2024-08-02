import { CoreError, IStandardization, IUserWithoutToken, enumCoreErrors, enumStudyRoles } from '@itmat-broker/itmat-types';
import { GraphQLError } from 'graphql';
import { errorCodes } from '../utils/errors';
import { v4 as uuid } from 'uuid';
import { makeGenericResponse } from '../utils/responses';
import { DBType } from '../database/database';
import { ObjectStore } from '@itmat-broker/itmat-commons';
import { PermissionCore } from './permissionCore';
import { StudyCore } from './studyCore';


/**
 * TODO: This file is not yet implemented. It is a placeholder for the standardization core.
 */

export class StandarizationCore {
    db: DBType;
    permissionCore: PermissionCore;
    studyCore: StudyCore;
    constructor(db: DBType, objStore: ObjectStore, permissionCore: PermissionCore, studyCore: StudyCore) {
        this.db = db;
        this.permissionCore = permissionCore;
        this.studyCore = studyCore;
    }

    public async getStandardization(requester: IUserWithoutToken | undefined, versionId: string | null, studyId: string, projectId?: string, type?: string) {
        if (!requester) {
            throw new CoreError(
                enumCoreErrors.NOT_LOGGED_IN,
                enumCoreErrors.NOT_LOGGED_IN
            );
        }
        /* check study exists */
        if (!studyId && !projectId) {
            throw new CoreError(
                enumCoreErrors.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY,
                'Either studyId or projectId should be provided.'
            );
        }

        /* check permission */
        const roles = await this.permissionCore.getRolesOfUser(requester, studyId);
        if (!roles.length) { throw new GraphQLError(errorCodes.NO_PERMISSION_ERROR); }

        const study = (await this.studyCore.getStudies(requester, studyId))[0];

        // get all dataVersions that are valid (before/equal the current version)
        const availableDataVersions: Array<string | null> = (study.currentDataVersion === -1 ? [] : study.dataVersions.filter((__unused__el, index) => index <= study.currentDataVersion)).map(el => el.id);
        if (versionId === null) {
            availableDataVersions.push(null);
        }
        const standardizations = await this.db.collections.standardizations_collection.aggregate([{
            $sort: { uploadedAt: -1 }
        }, {
            $match: { dataVersion: { $in: availableDataVersions } }
        }, {
            $match: { studyId: studyId, type: type ?? /^.*$/ }
        }, {
            $group: {
                _id: {
                    type: '$type',
                    field: '$field'
                },
                doc: { $first: '$$ROOT' }
            }
        }, {
            $replaceRoot: { newRoot: '$doc' }
        }, {
            $match: { deleted: null }
        }
        ]).toArray();
        return standardizations as IStandardization[];
    }

    public async createStandardization(requester: IUserWithoutToken | undefined, studyId, standardization) {
        if (!requester) {
            throw new CoreError(
                enumCoreErrors.NOT_LOGGED_IN,
                enumCoreErrors.NOT_LOGGED_IN
            );
        }
        /* check permission */
        const roles = await this.permissionCore.getRolesOfUser(requester, studyId);
        if (!roles.length || roles.every(el => el.studyRole !== enumStudyRoles.STUDY_MANAGER)) {
            throw new CoreError(
                enumCoreErrors.NO_PERMISSION_ERROR,
                enumCoreErrors.NO_PERMISSION_ERROR
            );
        }

        /* check study exists */
        const studySearchResult = await this.db.collections.studies_collection.findOne({ id: studyId, deleted: null });
        if (studySearchResult === null || studySearchResult === undefined) {
            throw new GraphQLError('Study does not exist.', { extensions: { code: errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY } });
        }
        const stdRulesWithId = [...standardization.stdRules];
        stdRulesWithId.forEach(el => {
            el.id = uuid();
        });
        const standardizationEntry: IStandardization = {
            id: uuid(),
            studyId: studyId,
            type: standardization.type,
            field: standardization.field,
            path: standardization.path,
            stdRules: stdRulesWithId || [],
            joinByKeys: standardization.joinByKeys || [],
            dataVersion: null,
            metadata: standardization.metadata,
            life: {
                createdTime: Date.now(),
                createdUser: requester.id,
                deletedTime: null,
                deletedUser: null
            }
        };

        await this.db.collections.standardizations_collection.findOneAndUpdate({ studyId: studyId, type: standardization.type, field: standardization.field, dataVersion: null }, {
            $set: { ...standardizationEntry }
        }, {
            upsert: true
        });
        return standardizationEntry;
    }

    public async deleteStandardization(requester: IUserWithoutToken | undefined, studyId, type, field) {
        if (!requester) {
            throw new GraphQLError(errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);
        }
        /* check permission */
        const roles = await this.permissionCore.getRolesOfUser(requester, studyId);
        if (!roles.length) { throw new GraphQLError(errorCodes.NO_PERMISSION_ERROR); }
        /* check study exists */
        const studySearchResult = await this.db.collections.studies_collection.findOne({ id: studyId, deleted: null });
        if (studySearchResult === null || studySearchResult === undefined) {
            throw new GraphQLError('Study does not exist.', { extensions: { code: errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY } });
        }

        // check type exists
        const types: string[] = await this.db.collections.standardizations_collection.distinct('type', { studyId: studyId, deleted: null });
        if (!types.includes(type)) {
            throw new GraphQLError('Type does not exist.', { extensions: { code: errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY } });
        }
        const result = await this.db.collections.standardizations_collection.findOneAndUpdate({ studyId: studyId, field: field, type: type, dataVersion: null }, {
            $set: {
                id: uuid(),
                studyId: studyId,
                field: field,
                type: type,
                dataVersion: null,
                uploadedAt: Date.now(),
                deleted: Date.now()
            }
        }, {
            upsert: true
        });
        return makeGenericResponse(result?.id || '');
    }
}

