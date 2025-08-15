import { ObjectStore } from '@itmat-broker/itmat-commons';
import { DBType } from '../database/database';
import { CoreError, FileUpload, IFile, IStudy, IStudyDataVersion, IUserWithoutToken, enumCacheStatus, enumConfigType, enumCoreErrors, enumFileCategories, enumFileTypes, enumStudyRoles, enumUserTypes } from '@itmat-broker/itmat-types';
import { Filter, UpdateFilter } from 'mongodb';
import { PermissionCore } from './permissionCore';
import { v4 as uuid } from 'uuid';
import { FileCore } from './fileCore';
import { makeGenericResponse } from '../utils';

export class StudyCore {
    db: DBType;
    objStore: ObjectStore;
    permissionCore: PermissionCore;
    fileCore: FileCore;
    constructor(db: DBType, objStore: ObjectStore, permissionCore: PermissionCore, fileCore: FileCore) {
        this.db = db;
        this.objStore = objStore;
        this.permissionCore = permissionCore;
        this.fileCore = fileCore;
    }
    /**
     * Get the info of a study.
     *
     * @param studyId - The id of the study.
     *
     * @return IStudy - The object of IStudy.
     */
    public async getStudies(requester: IUserWithoutToken | undefined, studyId?: string) {
        if (!requester) {
            throw new CoreError(
                enumCoreErrors.NOT_LOGGED_IN,
                enumCoreErrors.NOT_LOGGED_IN
            );
        }
        let studies: IStudy[] = [];
        if (requester.type === enumUserTypes.ADMIN) {
            studies = studyId ? await this.db.collections.studies_collection.find({ 'id': studyId, 'life.deletedTime': null }).toArray() :
                await this.db.collections.studies_collection.find({ 'life.deletedTime': null }).toArray();
        } else {
            const roleStudyIds = (await this.permissionCore.getRolesOfUser(requester, requester.id)).map(role => role.studyId);
            const query: Filter<IStudy> = { 'life.deletedTime': null };
            if (studyId) {
                if (!roleStudyIds.includes(studyId)) {
                    throw new CoreError(
                        enumCoreErrors.NO_PERMISSION_ERROR,
                        'No permission to access the study.'
                    );
                }
                query.id = studyId;
            } else {
                query.id = { $in: roleStudyIds };
            }
            studies = await this.db.collections.studies_collection.find(query).toArray();
        }
        if (studies.length === 0 && studyId) {
            throw new CoreError(
                enumCoreErrors.NO_PERMISSION_ERROR,
                'No permission to access the study.'
            );
        }
        return studies;
    }

    /**
     * Create a study.
     *
     * @param requester - The id of the requester.
     * @param studyName - The name of the study.
     * @param description - The description of the study.
     *
     * @return IStudy - The object of the IStudy.
     */
    public async createStudy(requester: IUserWithoutToken | undefined, studyName: string, description?: string, profile?: FileUpload): Promise<Partial<IStudy>> {
        if (!requester) {
            throw new CoreError(
                enumCoreErrors.NOT_LOGGED_IN,
                enumCoreErrors.NOT_LOGGED_IN
            );
        }

        if (requester.type !== enumUserTypes.ADMIN) {
            throw new CoreError(
                enumCoreErrors.NO_PERMISSION_ERROR,
                'Only admin can create a study.'
            );
        }

        const studyId = uuid();
        const existing = await this.db.collections.studies_collection.findOne({
            'name': { $regex: new RegExp('^' + studyName + '$', 'i') },
            'life.deletedTime': null
        });
        if (existing) {
            throw new CoreError(
                enumCoreErrors.CLIENT_MALFORMED_INPUT,
                'Study name already used.'
            );
        }

        const studyEntry: IStudy = {
            id: studyId,
            name: studyName,
            currentDataVersion: -1,
            dataVersions: [],
            description: description ?? '',
            life: {
                createdTime: Date.now(),
                createdUser: requester.id,
                deletedTime: null,
                deletedUser: null
            },
            metadata: {},
            isPublic: false
        };
        // create a default study config
        await this.db.collections.configs_collection.insertOne({
            id: uuid(),
            type: enumConfigType.STUDYCONFIG,
            key: studyEntry.id,
            properties: {
                id: uuid(),
                life: {
                    createdTime: Date.now(),
                    createdUser: requester.id,
                    deletedTime: null,
                    deletedUser: null
                },
                metadata: {},
                defaultStudyProfile: null,
                defaultMaximumFileSize: 8 * 1024 * 1024 * 1024, // 8 GB,
                defaultRepresentationForMissingValue: '99999',
                defaultFileBlocks: [],
                defaultVersioningKeys: []
            },
            life: {
                createdTime: Date.now(),
                createdUser: requester.id,
                deletedTime: null,
                deletedUser: null
            },
            metadata: {}
        });

        await this.db.collections.studies_collection.insertOne(studyEntry);
        let fileEntry: IFile | null = null;
        if (profile) {
            if (!Object.keys(enumFileTypes).includes((profile?.filename?.split('.').pop() || '').toUpperCase())) {
                throw new CoreError(
                    enumCoreErrors.CLIENT_MALFORMED_INPUT,
                    'File type not supported.'
                );
            }
            fileEntry = await this.fileCore.uploadFile(requester, studyId, null, profile, enumFileTypes[(profile.filename.split('.').pop() || '').toUpperCase() as keyof typeof enumFileTypes], enumFileCategories.PROFILE_FILE);
            await this.db.collections.studies_collection.findOneAndUpdate({ id: studyId }, {
                $set: {
                    profile: fileEntry.id
                }
            }, {
                returnDocument: 'after'
            });

            return {
                ...studyEntry,
                profile: fileEntry.id
            };
        }
        return studyEntry;
    }

    /**
     * Edit the description of the study.
     *
     * @param requester - The requester.
     * @param studyId - The id of the study.
     * @param name - The name of the study.
     * @param description - The description of the study.
     * @param profile - The profile of the study.
     *
     * @return IStudy - The object of IStudy
     */
    public async editStudy(requester: IUserWithoutToken | undefined, studyId: string, name?: string, description?: string, profile?: FileUpload) {
        if (!requester) {
            throw new CoreError(
                enumCoreErrors.NOT_LOGGED_IN,
                enumCoreErrors.NOT_LOGGED_IN
            );
        }
        const roleStudyRoles: enumStudyRoles[] = (await this.permissionCore.getRolesOfUser(requester, requester.id, studyId)).map(role => role.studyRole);
        if (requester.type !== enumUserTypes.ADMIN && !roleStudyRoles.includes(enumStudyRoles.STUDY_MANAGER)) {
            throw new CoreError(
                enumCoreErrors.NO_PERMISSION_ERROR,
                'Only admin or study manager can edit a study.'
            );
        }

        const study = await this.db.collections.studies_collection.findOne({ 'id': studyId, 'life.deletedTime': null });
        if (!study) {
            throw new CoreError(
                enumCoreErrors.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY,
                'Study does not exist.'
            );
        }

        const setObj: UpdateFilter<IStudy> = {};
        let fileEntry;
        if (profile) {
            try {
                if (!Object.keys(enumFileTypes).includes((profile?.filename?.split('.').pop() || '').toUpperCase())) {
                    throw new CoreError(
                        enumCoreErrors.CLIENT_MALFORMED_INPUT,
                        'File format not supported'
                    );
                }
                fileEntry = await this.fileCore.uploadFile(requester, studyId, null, profile, enumFileTypes[(profile.filename.split('.').pop() || '').toUpperCase() as keyof typeof enumFileTypes], enumFileCategories.PROFILE_FILE);
                setObj['profile'] = fileEntry.id;
            } catch (__unused__exception) {
                setObj['profile'] = study.profile;
            }
        }
        if (name) {
            if (name !== study.name) {
                const existing = await this.db.collections.studies_collection.findOne({ 'name': name, 'life.deletedTime': null });
                if (existing) {
                    throw new CoreError(
                        enumCoreErrors.CLIENT_MALFORMED_INPUT,
                        'Study name already used.'
                    );
                }
            }
            setObj['name'] = name;
        }
        if (description) {
            setObj['description'] = description;
        }
        const response = await this.db.collections.studies_collection.findOneAndUpdate({ id: studyId }, {
            $set: setObj
        }, {
            returnDocument: 'after'
        });
        return response;

    }
    /**
     * Edit the visibility of a study.
     *
     * @param requester - The requester.
     * @param studyId - The id of the study.
     * @param isPublic - The visibility status of the study.
     *
     * @return IStudy - The updated study object.
     */
    public async editStudyVisibility(requester: IUserWithoutToken | undefined, studyId: string, isPublic: boolean) {
        if (!requester) {
            throw new CoreError(
                enumCoreErrors.NOT_LOGGED_IN,
                enumCoreErrors.NOT_LOGGED_IN
            );
        }

        // Check permissions - only admin or study manager can change visibility
        const roleStudyRoles: enumStudyRoles[] = (await this.permissionCore.getRolesOfUser(requester, requester.id, studyId)).map(role => role.studyRole);
        if (requester.type !== enumUserTypes.ADMIN && !roleStudyRoles.includes(enumStudyRoles.STUDY_MANAGER)) {
            throw new CoreError(
                enumCoreErrors.NO_PERMISSION_ERROR,
                'Only admin or study manager can change study visibility.'
            );
        }

        const study = await this.db.collections.studies_collection.findOne({ 'id': studyId, 'life.deletedTime': null });
        if (!study) {
            throw new CoreError(
                enumCoreErrors.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY,
                'Study does not exist.'
            );
        }

        // Update the study visibility
        const setObj: UpdateFilter<IStudy> = {
            isPublic: isPublic
        };

        const response = await this.db.collections.studies_collection.findOneAndUpdate(
            { id: studyId },
            { $set: setObj },
            { returnDocument: 'after' }
        );

        return response;
    }
    /**
     * Delete a study.
     *
     * @param requester - The id of the requester.
     * @param studyId - The id of the study.
     *
     * @return IGenericResponse - The obejct of IGenericResponse.
     */
    public async deleteStudy(requester: IUserWithoutToken | undefined, studyId: string) {
        if (!requester) {
            throw new CoreError(
                enumCoreErrors.NOT_LOGGED_IN,
                enumCoreErrors.NOT_LOGGED_IN
            );
        }

        if (requester.type !== 'ADMIN') {
            throw new CoreError(
                enumCoreErrors.NO_PERMISSION_ERROR,
                'Only admin can delete a study.'
            );
        }

        const study = await this.db.collections.studies_collection.findOne({ 'id': studyId, 'life.deletedTime': null });
        if (!study) {
            throw new CoreError(
                enumCoreErrors.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY,
                'Study does not exist.'
            );
        }

        const timestamp = new Date().valueOf();
        /* delete the study */
        await this.db.collections.studies_collection.findOneAndUpdate({ 'id': studyId, 'life.deletedTime': null }, { $set: { 'life.deletedTime': timestamp, 'life.deletedUser': requester } });

        /* delete all roles related to the study */
        // await this.localPermissionCore.removeRoleFromStudyOrProject({ studyId });

        /* delete all files belong to the study*/
        await this.db.collections.files_collection.updateMany({ 'studyId': studyId, 'life.deletedTime': null }, { $set: { 'life.deletedTime': timestamp, 'life.deletedUser': requester } });

        /* delete all fields belong to the study*/
        await this.db.collections.field_dictionary_collection.updateMany({ 'studyId': studyId, 'life.deletedTime': null }, { $set: { 'life.deletedTime': timestamp, 'life.deletedUser': requester } });

        /* delete all data belong to the study*/
        await this.db.collections.data_collection.updateMany({ 'studyId': studyId, 'life.deletedTime': null }, { $set: { 'life.deletedTime': timestamp, 'life.deletedUser': requester } });

        /* delete all config belong to the study*/
        await this.db.collections.configs_collection.updateMany({ 'type': enumConfigType.STUDYCONFIG, 'key': studyId, 'life.deletedTime': null }, { $set: { 'life.deletedTime': timestamp, 'life.deletedUser': requester } });

        return makeGenericResponse(studyId, true, undefined, `Study ${study.name} has been deleted.`);
    }
    /**
     * Create a new data version of the study.
     *
     * @param requester - The id of the requester.
     * @param studyId - The id of the study.
     * @param tag - The tag of the study.
     * @param dataVersion - The new version of the study. Use float number.
     *
     * @return IGenericResponse - The object of IGenericResponse.
     */
    public async createDataVersion(requester: IUserWithoutToken | undefined, studyId: string, tag: string, dataVersion: string, syncCold?: boolean) {
        if (!requester) {
            throw new CoreError(
                enumCoreErrors.NOT_LOGGED_IN,
                enumCoreErrors.NOT_LOGGED_IN
            );
        }

        const roleStudyRoles: enumStudyRoles[] = (await this.permissionCore.getRolesOfUser(requester, requester.id)).map(role => role.studyRole);
        if (requester.type !== enumUserTypes.ADMIN && !roleStudyRoles.includes(enumStudyRoles.STUDY_MANAGER)) {
            throw new CoreError(
                enumCoreErrors.NO_PERMISSION_ERROR,
                'Only admin or study manager can create a study version.'
            );
        }

        const study = await this.db.collections.studies_collection.findOne({ 'id': studyId, 'life.deletedTime': null });
        if (!study) {
            throw new CoreError(
                enumCoreErrors.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY,
                'Study does not exist.'
            );
        }

        const decimalRegex = /^[0-9]+(\.[0-9]+)?$/;
        if (!decimalRegex.test(dataVersion)) {
            throw new CoreError(
                enumCoreErrors.CLIENT_MALFORMED_INPUT,
                'Version must be a float number.'
            );
        }

        if (study.dataVersions.map(el => el.version).includes(dataVersion)) {
            throw new CoreError(
                enumCoreErrors.CLIENT_MALFORMED_INPUT,
                'Version has been used.'
            );
        }

        const newDataVersionId = uuid();


        // update data
        const resData = await this.db.collections.data_collection.updateMany({
            studyId: studyId,
            dataVersion: null
        }, {
            $set: {
                dataVersion: newDataVersionId
            }
        });
        // update field
        const resField = await this.db.collections.field_dictionary_collection.updateMany({
            studyId: studyId,
            dataVersion: null
        }, {
            $set: {
                dataVersion: newDataVersionId
            }
        });

        // TODO: invalidate cache
        await this.db.collections.cache_collection.updateMany({
            'keys.studyId': studyId
        }, {
            $set: {
                status: enumCacheStatus.OUTDATED
            }
        });

        // TODO: update stds, ontologies

        // TODO: update cold storage
        if (syncCold) {
            const batchSize = 1000; // Define the batch size for processing
            const cursor = this.db.collections.data_collection.find({ studyId: studyId, dataVersion: newDataVersionId }).batchSize(batchSize);

            let bulkOperation = this.db.collections.colddata_collection.initializeUnorderedBulkOp();
            let documentCount = 0;

            while (await cursor.hasNext()) {
                const doc = await cursor.next();
                if (!doc) {
                    break;
                }
                const filters = {
                    studyId: studyId,
                    fieldId: doc.fieldId,
                    properties: doc.properties
                };

                bulkOperation.find(filters).upsert().update({
                    $set: {
                        id: uuid(),
                        value: doc.value,
                        dataVersion: newDataVersionId,
                        life: {
                            createdTime: Date.now(),
                            createdUser: requester.id,
                            deletedTime: null,
                            deletedUser: null
                        },
                        metadata: {}
                    }
                });

                documentCount++;

                // Execute batch if it reaches 1000 operations or if batch size limit is hit
                if (documentCount % 1000 === 0) {
                    await bulkOperation.execute();
                    bulkOperation = this.db.collections.colddata_collection.initializeUnorderedBulkOp(); // Re-initialize bulk operation
                }
            }

            // Execute any remaining operations in bulk
            if (documentCount % 1000 !== 0) {
                await bulkOperation.execute();
            }
        }

        const newDataVersion: IStudyDataVersion = {
            id: newDataVersionId,
            version: dataVersion,
            tag: tag,
            life: {
                createdTime: Date.now(),
                createdUser: requester.id,
                deletedTime: null,
                deletedUser: null
            },
            metadata: {}
        };
        await this.db.collections.studies_collection.updateOne({ id: studyId }, {
            $push: { dataVersions: newDataVersion },
            $inc: {
                currentDataVersion: 1
            }
        });
        if (resData.modifiedCount === 0 && resField.modifiedCount === 0) {
            throw new CoreError(
                enumCoreErrors.UNQUALIFIED_ERROR,
                'Nothing to update.'
            );
        } else {
            return newDataVersion;
        }
    }

    /**
     * Set a data version as the current data version of a study.
     *
     * @param requester - The requester.
     * @param studyId - The id of the study.
     * @param dataVersionId - The id of the data version.
     * @returns IGenericResponse
     */
    public async setDataversionAsCurrent(requester: IUserWithoutToken | undefined, studyId: string, dataVersionId: string) {
        if (!requester) {
            throw new CoreError(
                enumCoreErrors.NOT_LOGGED_IN,
                enumCoreErrors.NOT_LOGGED_IN
            );
        }

        /* check privileges */
        const roleStudyRoles: enumStudyRoles[] = (await this.permissionCore.getRolesOfUser(requester, requester.id)).map(role => role.studyRole);
        if (requester.type !== enumUserTypes.ADMIN && !roleStudyRoles.includes(enumStudyRoles.STUDY_MANAGER)) {
            throw new CoreError(
                enumCoreErrors.NO_PERMISSION_ERROR,
                'Only admin or study manager can set a study version.'
            );
        }

        const study = await this.db.collections.studies_collection.findOne({ 'id': studyId, 'life.deletedTime': null });
        if (!study) {
            throw new CoreError(
                enumCoreErrors.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY,
                'Study does not exist.'
            );
        }

        /* check whether the dataversion exists */
        const selectedataVersionFiltered = study.dataVersions.filter((el) => el.id === dataVersionId);
        if (selectedataVersionFiltered.length !== 1) {
            throw new CoreError(
                enumCoreErrors.CLIENT_MALFORMED_INPUT,
                'Data version does not exist.'
            );
        }

        /* update the currentversion field in database */
        const versionIdsList = study.dataVersions.map((el) => el.id);
        await this.db.collections.studies_collection.findOneAndUpdate({ id: studyId, deleted: null }, {
            $set: { currentDataVersion: versionIdsList.indexOf(dataVersionId) }
        }, {
            returnDocument: 'after'
        });

        return makeGenericResponse(studyId, true, undefined, `Data version ${dataVersionId} has been set as the current version of study ${study.name}.`);
    }
}
