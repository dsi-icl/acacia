import { v4 as uuid } from 'uuid';
import { CoreError, FileUpload, IFile, IOrganisation, IUserWithoutToken, enumCoreErrors, enumFileCategories, enumFileTypes, enumUserTypes } from '@itmat-broker/itmat-types';
import { DBType } from '../database/database';
import { FileCore } from './fileCore';
import { UpdateFilter } from 'mongodb';
import { makeGenericResponse } from '../utils';

export class OrganisationCore {
    db: DBType;
    fileCore: FileCore;
    constructor(db: DBType, fileCore: FileCore) {
        this.db = db;
        this.fileCore = fileCore;
    }

    /**
     * Get organisations.
     *
     * @param requester - The requester.
     * @param organisationId - The organisation id.
     *
     * @returns - IOrganisation[]
     */
    public async getOrganisations(requester: IUserWithoutToken | undefined, organisationId?: string) {
        return organisationId ? await this.db.collections.organisations_collection.find({ 'id': organisationId, 'life.deletedTime': null }).toArray() : await this.db.collections.organisations_collection.find({ 'life.deletedTime': null }).toArray();
    }

    /**
     * Creates a new organisation.
     *
     * @param requester - The requester.
     * @param name - The name of the organisation.
     * @param shortname - The shortname of the organisation.
     * @param profile - The profile of the organisation.
     *
     * @returns - IOrganisation
     */
    public async createOrganisation(requester: IUserWithoutToken | undefined, name: string, shortname?: string, profile?: FileUpload) {
        if (!requester) {
            throw new CoreError(
                enumCoreErrors.NOT_LOGGED_IN,
                enumCoreErrors.NOT_LOGGED_IN
            );
        }

        if (requester.type !== enumUserTypes.ADMIN) {
            throw new CoreError(
                enumCoreErrors.NO_PERMISSION_ERROR,
                enumCoreErrors.NO_PERMISSION_ERROR
            );
        }

        const organisation = await this.db.collections.organisations_collection.findOne({ 'name': name, 'life.deletedTime': null });
        if (organisation) {
            throw new CoreError(
                enumCoreErrors.CLIENT_MALFORMED_INPUT,
                'Organisation already exists.'
            );
        }

        let fileEntry: IFile | undefined = undefined;
        if (profile) {
            if (!Object.keys(enumFileTypes).includes((profile?.filename?.split('.').pop() || '').toUpperCase())) {
                throw new CoreError(
                    enumCoreErrors.CLIENT_MALFORMED_INPUT,
                    'File type not supported.'
                );
            }
            fileEntry = await this.fileCore.uploadFile(requester, null, null, profile,
                enumFileTypes[(profile.filename.split('.').pop() || '').toUpperCase() as keyof typeof enumFileTypes], enumFileCategories.PROFILE_FILE);
        }

        const entry: IOrganisation = {
            id: uuid(),
            name: name,
            shortname: shortname,
            profile: fileEntry ? fileEntry.id : undefined,
            life: {
                createdTime: Date.now(),
                createdUser: requester.id,
                deletedTime: null,
                deletedUser: null
            },
            metadata: {}
        };

        await this.db.collections.organisations_collection.insertOne(entry);
        return entry;
    }

    /**
     * Edits an organisation.
     *
     * @param requester - The requester.
     * @param organisationId - The organisation id.
     * @param name - The name of the organisation.
     * @param shortname - The shortname of the organisation.
     * @param profile - The profile of the organisation.
     *
     * @returns - IOrganisation
     */
    public async editOrganisation(requester: IUserWithoutToken | undefined, organisationId: string, name?: string, shortname?: string, profile?: FileUpload) {
        if (!requester) {
            throw new CoreError(
                enumCoreErrors.NOT_LOGGED_IN,
                enumCoreErrors.NOT_LOGGED_IN
            );
        }

        if (requester.type !== enumUserTypes.ADMIN) {
            throw new CoreError(
                enumCoreErrors.NO_PERMISSION_ERROR,
                enumCoreErrors.NO_PERMISSION_ERROR
            );
        }

        const organisation = await this.db.collections.organisations_collection.findOne({ 'id': organisationId, 'life.deletedTime': null });
        if (!organisation) {
            throw new CoreError(
                enumCoreErrors.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY,
                'Organisation not found.'
            );
        }

        const updateFilter: UpdateFilter<IOrganisation> = {};
        if (name) {
            const org = await this.db.collections.organisations_collection.findOne({ 'name': name, 'life.deletedTime': null });
            if (org && org.id !== organisationId) {
                throw new CoreError(
                    enumCoreErrors.CLIENT_MALFORMED_INPUT,
                    'Organisation already exists.'
                );
            }
            updateFilter['name'] = name;
        }
        if (shortname) {
            updateFilter['shortname'] = shortname;
        }
        if (profile) {
            if (!Object.keys(enumFileTypes).includes((profile?.filename?.split('.').pop() || '').toUpperCase())) {
                throw new CoreError(
                    enumCoreErrors.CLIENT_MALFORMED_INPUT,
                    'File type not supported.'
                );
            }
            const fileEntry = await this.fileCore.uploadFile(requester, null, null, profile,
                enumFileTypes[(profile.filename.split('.').pop() || '').toUpperCase() as keyof typeof enumFileTypes], enumFileCategories.PROFILE_FILE);
            updateFilter['profile'] = fileEntry.id;
        }

        await this.db.collections.organisations_collection.updateOne({ id: organisationId }, { $set: updateFilter });

        return makeGenericResponse(organisationId, true, undefined, 'Organisation updated successfully.');
    }

    /**
     * Deletes an organisation.
     *
     * @param requester - The requester.
     * @param organisationId - The organisation id.
     *
     * @returns - IOrganisation
     */
    public async deleteOrganisation(requester: IUserWithoutToken | undefined, organisationId: string) {
        if (!requester) {
            throw new CoreError(
                enumCoreErrors.NOT_LOGGED_IN,
                enumCoreErrors.NOT_LOGGED_IN
            );
        }

        if (requester.type !== enumUserTypes.ADMIN) {
            throw new CoreError(
                enumCoreErrors.NO_PERMISSION_ERROR,
                enumCoreErrors.NO_PERMISSION_ERROR
            );
        }

        const organisation = await this.db.collections.organisations_collection.findOne({ 'id': organisationId, 'life.deletedTime': null });
        if (!organisation) {
            throw new CoreError(
                enumCoreErrors.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY,
                'Organisation not found.'
            );
        }

        await this.db.collections.organisations_collection.updateOne({ id: organisationId }, { $set: { 'life.deletedTime': Date.now(), 'life.deletedUser': requester.id } });

        return makeGenericResponse(organisationId, true, undefined, 'Organisation deleted successfully.');
    }
}