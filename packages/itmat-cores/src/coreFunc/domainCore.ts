import { CoreError, FileUpload, IDomain, IUserWithoutToken, enumCoreErrors, enumFileCategories, enumFileTypes, enumUserTypes } from '@itmat-broker/itmat-types';
import { v4 as uuid } from 'uuid';
import { DBType } from '../database/database';
import { FileCore } from './fileCore';
import { Filter, UpdateFilter } from 'mongodb';
import { makeGenericResponse } from '../utils';


export class DomainCore {
    db: DBType;
    fileCore: FileCore;
    constructor(db: DBType, fileCore: FileCore) {
        this.db = db;
        this.fileCore = fileCore;
    }
    /**
     * Get domain by domainId, domainName or domainPath.
     *
     * @param requester - The requester.
     * @param domainId - The id of the domain.
     * @param domainName - The name of the domain.
     * @param domainPath - The path of the domain.
     *
     * @returns The domain objects.
     */
    public async getDomains(requester: IUserWithoutToken | undefined, domainId?: string, domainName?: string, domainPath?: string) {
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

        const obj: Filter<IDomain> = {
            'life.deletedTime': null
        };
        if (domainId) {
            obj.id = domainId;
        }
        if (domainName) {
            obj.name = domainName;
        }
        if (domainPath) {
            obj.domainPath = domainPath;
        }

        return (await this.db.collections.domains_collection.find(obj).toArray()) as IDomain[];
    }

    /**
     * Get the domain of an endpoint. Note this is a helper function for not logged in users.
     *
     * @param endpoint - The endpoint.
     *
     * @returns The domain object.
     */
    public async getCurrentDomain(opts) {
        const endpoint = await this.getCurrentSubPath(opts);
        if (!endpoint) {
            throw new CoreError(
                enumCoreErrors.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY,
                'Domain does not exist.'
            );
        }
        return await this.db.collections.domains_collection.findOne({
            domainPath: { $regex: new RegExp(`^${endpoint}$`, 'i') }
        });
    }

    /**
     * Create a domain.
     *
     * @param requester - The requester.
     * @param domainName - The name of the domain.
     * @param domainPath - The path of the domain.
     * @param profile - The profile of the domain.
     * @param color - The color of the domain.
     *
     * @returns The domain object.
     */
    public async createDomain(requester: IUserWithoutToken | undefined, domainName: string, domainPath: string, logo?: FileUpload, color?: string) {
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

        const domain = await this.db.collections.domains_collection.findOne({ 'domainPath': domainPath, 'life.deletedTime': null });
        if (domain) {
            throw new CoreError(
                enumCoreErrors.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY,
                'Domain already exists.'
            );
        }
        let fileEntry;

        if (logo) {
            if (!Object.keys(enumFileTypes).includes((logo?.filename?.split('.').pop() || '').toUpperCase())) {
                throw new CoreError(
                    enumCoreErrors.CLIENT_MALFORMED_INPUT,
                    'File type not supported.'
                );
            }
            fileEntry = await this.fileCore.uploadFile(requester, null, null, logo, enumFileTypes[(logo.filename.split('.').pop() || '').toUpperCase() as keyof typeof enumFileTypes], enumFileCategories.DOMAIN_FILE);
        }

        const entry: IDomain = {
            id: uuid(),
            name: domainName,
            domainPath: domainPath,
            logo: (logo && fileEntry) ? fileEntry.id : undefined,
            color: color,
            life: {
                createdTime: Date.now(),
                createdUser: requester.id,
                deletedTime: null,
                deletedUser: null
            },
            metadata: {}
        };
        await this.db.collections.domains_collection.insertOne(entry);
        return entry;
    }

    public async editDomain(requester: IUserWithoutToken | undefined, domainId: string, domainName?: string, domainPath?: string, logo?: FileUpload, color?: string) {
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

        const domain = await this.db.collections.domains_collection.findOne({ 'id': domainId, 'life.deletedTime': null });
        if (!domain) {
            throw new CoreError(
                enumCoreErrors.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY,
                'Domain does not exist.'
            );
        }

        if (domainPath) {
            const domainWithSamePath = await this.db.collections.domains_collection.findOne({ 'domainPath': domainPath, 'life.deletedTime': null });
            if (domainWithSamePath && domainWithSamePath.id !== domainId) {
                throw new CoreError(
                    enumCoreErrors.CLIENT_MALFORMED_INPUT,
                    'Domain path already exists.'
                );
            }
        }

        let fileEntry;
        if (logo) {
            if (!Object.keys(enumFileTypes).includes((logo?.filename?.split('.').pop() || '').toUpperCase())) {
                throw new CoreError(
                    enumCoreErrors.CLIENT_MALFORMED_INPUT,
                    'File type not supported.'
                );
            }
            fileEntry = await this.fileCore.uploadFile(requester, null, null, logo, enumFileTypes[(logo.filename.split('.').pop() || '').toUpperCase() as keyof typeof enumFileTypes], enumFileCategories.DOMAIN_FILE);
        }

        const updateObj: UpdateFilter<IDomain> = {};
        if (domainName) {
            updateObj['name'] = domainName;
        }
        if (domainPath) {
            updateObj['domainPath'] = domainPath;
        }
        if (color) {
            updateObj['color'] = color;
        }
        if (fileEntry) {
            updateObj['logo'] = fileEntry.id;
        }

        await this.db.collections.domains_collection.findOneAndUpdate({ id: domain.id }, {
            $set: updateObj
        });
        return makeGenericResponse(domainId, true, undefined, `Domain ${domain.name} has been updated`);
    }

    /**
     * Delete a domain.
     *
     * @param requester - The requester.
     * @param domainId - The id of the domain.
     *
     * @returns - The response object.
     */
    public async deleteDomain(requester: IUserWithoutToken | undefined, domainId: string) {
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

        const domain = await this.db.collections.domains_collection.findOne({ 'id': domainId, 'life.deletedTime': null });
        if (!domain) {
            throw new CoreError(
                enumCoreErrors.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY,
                'Domain does not exist.'
            );
        }

        await this.db.collections.domains_collection.findOneAndUpdate({ id: domain.id }, {
            $set: {
                'life.deletedUser': requester.id,
                'life.deletedTime': Date.now()
            }
        });
        if (domain.logo) {
            await this.db.collections.files_collection.findOneAndUpdate({ id: domain.logo }, {
                $set: {
                    'life.deletedUser': requester.id,
                    'life.deletedTime': Date.now()
                }
            });
        }
        return makeGenericResponse(domainId, true, undefined, `Domain ${domain.name} has been deleted`);
    }

    public async getCurrentSubPath(opts) {
        const req = opts.ctx.req;
        return req.hostname ?? null;
    }
}
