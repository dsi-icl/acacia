import { DBType } from '../database/database';
import { enumUserTypes, enumFileTypes, enumFileCategories, IDrive, enumDriveNodeTypes, IFile, IDrivePermission, FileUpload, CoreError, enumCoreErrors, IUserWithoutToken, enumConfigType, defaultSettings, IUserConfig } from '@itmat-broker/itmat-types';
import { v4 as uuid } from 'uuid';
import { FileCore } from './fileCore';
import { UpdateFilter } from 'mongodb';
import { ObjectStore } from '@itmat-broker/itmat-commons';
import { makeGenericResponse } from '../utils';

export class DriveCore {
    db: DBType;
    fileCore: FileCore;
    objectStore: ObjectStore;
    constructor(db: DBType, fileCore: FileCore, ObjectStore: ObjectStore) {
        this.db = db;
        this.fileCore = fileCore;
        this.objectStore = ObjectStore;
    }
    /**
     * Create a drive folder.
     *
     * @param requester - The requester.
     * @param folderName - The name of the folder.
     * @param parentId - The id of the parent. Null for default root node.
     * @param protected - Whether this folder is protected. Protected folder could not be deleted.
     * @param description - The description of the folder.
     *
     * @return IDrive
     */
    public async createDriveFolder(requester: IUserWithoutToken | undefined, folderName: string, parentId: string | null, restricted: boolean, description?: string) {
        if (!requester) {
            throw new CoreError(
                enumCoreErrors.NOT_LOGGED_IN,
                enumCoreErrors.NOT_LOGGED_IN
            );
        }
        // check parent existence
        let parent;
        if (parentId) {
            parent = await this.db.collections.drives_collection.findOne({ 'id': parentId, 'life.deletedTime': null });
        } else {
            // if parent is not specified, use default root node
            parent = await this.db.collections.drives_collection.findOne({ managerId: requester.id, parent: null });
        }

        if (!parent || (parent.sharedUsers.filter(el => el.iid === requester.id && el.write === true).length === 0
            && parent.managerId !== requester.id)) {
            throw new CoreError(
                enumCoreErrors.NO_PERMISSION_ERROR,
                'No permission to create folder.'
            );
        }

        if (parent.type !== enumDriveNodeTypes.FOLDER) {
            throw new CoreError(
                enumCoreErrors.CLIENT_MALFORMED_INPUT,
                'Parent is not a folder.'
            );
        }

        // check duplicates, there should not be a same folder in this path
        const children = await this.db.collections.drives_collection.find({ 'parent': parent.id, 'life.deletedTime': null }).toArray();
        if (children.filter(el => el.type === enumDriveNodeTypes.FOLDER).map(el => el.name).includes(folderName)) {
            throw new CoreError(
                enumCoreErrors.CLIENT_MALFORMED_INPUT,
                'Folder already exists.'
            );
        }

        const folderDriveId = uuid();
        const driveEntry: IDrive = {
            id: folderDriveId,
            path: parent?.path.concat(folderDriveId) ?? [],
            // we allow users to create drive under another user's drive; but the manager of the new drive is the managerId of the parent drive
            managerId: parent.managerId == requester.id ? requester.id : parent.managerId,
            restricted: restricted,
            name: folderName,
            description: description,
            fileId: null,
            type: enumDriveNodeTypes.FOLDER,
            parent: parent.id,
            children: [],
            sharedUsers: parent ? parent.sharedUsers : [],
            life: {
                createdTime: Date.now(),
                createdUser: requester.id,
                deletedTime: null,
                deletedUser: null
            },
            metadata: {}
        };

        await this.db.collections.drives_collection.insertOne(driveEntry);

        // update parent
        await this.db.collections.drives_collection.findOneAndUpdate({ id: parent.id }, {
            $push: { children: driveEntry.id }
        });

        return driveEntry;
    }

    /**
     * Add/Upload a file to the user file repo.
     *
     * @param requester - The requester.
     * @param parentId - The id of the file Node. Null for default root node.
     * @param description - The description of the file.
     * @param fileType - The type of the file.
     * @param file - The file to upload.
     *
     * @return IDrive
     */
    public async createDriveFile(requester: IUserWithoutToken | undefined, parentId: string | null, description: string | undefined, fileType: enumFileTypes, file: FileUpload) {
        if (!requester) {
            throw new CoreError(
                enumCoreErrors.NOT_LOGGED_IN,
                enumCoreErrors.NOT_LOGGED_IN
            );
        }
        // check parent existence
        let parent;
        if (parentId && parentId !== '') {
            parent = await this.db.collections.drives_collection.findOne({ 'id': parentId, 'life.deletedTime': null });
            if (!parent) {
                throw new CoreError(
                    enumCoreErrors.NO_PERMISSION_ERROR,
                    enumCoreErrors.NO_PERMISSION_ERROR
                );
            }
        } else {
            parent = await this.db.collections.drives_collection.findOne({ managerId: requester.id, parent: null });
            if (!parent) {
                throw new CoreError(
                    enumCoreErrors.NO_PERMISSION_ERROR,
                    enumCoreErrors.NO_PERMISSION_ERROR
                );
            }
        }

        if (parent.sharedUsers.filter(el => el.iid === requester && el.write === true).length === 0
            && parent.managerId !== requester.id) {
            throw new CoreError(
                enumCoreErrors.NO_PERMISSION_ERROR,
                enumCoreErrors.NO_PERMISSION_ERROR
            );
        }

        if (parent.type !== enumDriveNodeTypes.FOLDER) {
            throw new CoreError(
                enumCoreErrors.CLIENT_MALFORMED_INPUT,
                'Parent is not a folder.'
            );
        }

        let fileEntry: IFile | null = null;
        if (file && fileType) {
            // check duplicates, there should not be a same folder in this path
            const children = await this.db.collections.drives_collection.find({ 'parent': parentId, 'life.deletedTime': null }).toArray();
            if (children.filter(el => el.type === enumDriveNodeTypes.FILE).map(el => el.name).includes(file?.filename)) {
                throw new CoreError(
                    enumCoreErrors.CLIENT_MALFORMED_INPUT,
                    'File already exists.'
                );
            }
            fileEntry = await this.fileCore.uploadFile(requester, null, requester.id, file, fileType, enumFileCategories.USER_DRIVE_FILE, description);
        } else {
            throw new CoreError(
                enumCoreErrors.CLIENT_MALFORMED_INPUT,
                'File or filetype not valid.'
            );
        }

        const fileDriveId = uuid();
        const driveEntry: IDrive = {
            id: fileDriveId,
            path: parent.path.concat(fileDriveId) ?? [],
            managerId: requester.id,
            restricted: false,
            name: file?.filename,
            description: description,
            fileId: fileEntry.id,
            type: enumDriveNodeTypes.FILE,
            parent: parent.id,
            children: [],
            sharedUsers: parent.sharedUsers,
            life: {
                createdTime: Date.now(),
                createdUser: requester.id,
                deletedTime: null,
                deletedUser: null
            },
            metadata: {
                fileSize: fileEntry.fileSize
            }
        };
        await this.db.collections.drives_collection.insertOne(driveEntry);

        // update parent
        await this.db.collections.drives_collection.findOneAndUpdate({ id: parent.id }, {
            $push: { children: driveEntry.id }
        });

        return driveEntry;
    }

    /**
     * Create a drive recursively. This is used for creating a folder with subfolders and files.
     *
     * @param requester - The requester.
     * @param parentId - The id of the parent node.
     * @param files - The files to upload.
     * @param paths - The paths of the files.
     * @returns
     */
    public async createRecursiveDrives(requester: IUserWithoutToken | undefined, parentId: string, files: FileUpload[], paths: string[][]) {
        if (!requester) {
            throw new CoreError(
                enumCoreErrors.NOT_LOGGED_IN,
                enumCoreErrors.NOT_LOGGED_IN
            );
        }
        // check parent existence
        let parent;
        if (parentId && parentId !== '') {
            parent = await this.db.collections.drives_collection.findOne({ 'id': parentId, 'life.deletedTime': null });
            if (!parent) {
                throw new CoreError(
                    enumCoreErrors.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY,
                    'Parent node does not exist.'
                );
            }
        } else {
            parent = await this.db.collections.drives_collection.findOne({ managerId: requester.id, parent: null });
            if (!parent) {
                throw new CoreError(
                    enumCoreErrors.CLIENT_MALFORMED_INPUT,
                    'Default root node not found.'
                );
            }
        }
        if (parent.type !== enumDriveNodeTypes.FOLDER) {
            throw new CoreError(
                enumCoreErrors.CLIENT_MALFORMED_INPUT,
                'Parent is not a folder.'
            );
        }

        const createdDrives: IDrive[] = [];
        for (let i = 0; i < paths.length; i++) {
            if (i < files.length) {
                // upload files
                let currentParent = parentId;
                for (let j = 0; j < paths[i].length - 1; j++) {
                    const existing = await this.db.collections.drives_collection.findOne({ 'parent': currentParent, 'name': paths[i][j], 'life.deletedTime': null });
                    if (!existing) {
                        const res = await this.createDriveFolder(requester, paths[i][j], currentParent, false, undefined);
                        currentParent = res.id;
                        createdDrives.push(res);
                    } else {
                        currentParent = existing.id;
                        createdDrives.push(existing);
                    }
                }
                const existing = await this.db.collections.drives_collection.findOne({ 'parent': currentParent, 'name': files[i].filename, 'life.deletedTime': null });
                if (!existing) {
                    let fileType = enumFileTypes.UNKNOWN;
                    if (Object.keys(enumFileTypes).includes((files[i]?.filename?.split('.').pop() || '').toUpperCase())) {
                        fileType = enumFileTypes[(files[i].filename.split('.').pop() || '').toUpperCase() as keyof typeof enumFileTypes];
                    }
                    const res = await this.createDriveFile(requester, currentParent, undefined, fileType, files[i]);
                    createdDrives.push(res);
                }
            } else {
                // upload empty folders
                let currentParent = parentId;
                for (let j = 0; j < paths[i].length; j++) {
                    const existing = await this.db.collections.drives_collection.findOne({ 'parent': currentParent, 'name': paths[i][j], 'life.deletedTime': null });
                    if (!existing) {
                        const res = await this.createDriveFolder(requester, paths[i][j], currentParent, false, undefined);
                        currentParent = res.id;
                        createdDrives.push(res);
                    } else {
                        currentParent = existing.id;
                        createdDrives.push(existing);
                    }
                }
            }
        }
        return createdDrives;
    }

    /**
     * Get the drive of a user, including own drives and shared drives.
     *
     * @param requester - The requester.
     * @param rootId - The id of the root drive if specified.
     *
     * @return Record<string, IDrive[] - An object where key is the user Id and value is the list of drive nodes.
     */
    public async getDrives(requester: IUserWithoutToken | undefined, rootId?: string) {
        if (!requester) {
            throw new CoreError(
                enumCoreErrors.NOT_LOGGED_IN,
                enumCoreErrors.NOT_LOGGED_IN
            );
        }

        let rootDrive: IDrive | null = null;
        if (rootId) {
            rootDrive = await this.db.collections.drives_collection.findOne({ 'id': rootId, 'life.deletedTime': null });
            if (!rootDrive) {
                throw new CoreError(
                    enumCoreErrors.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY,
                    'Root drive does not exist.'
                );
            }
        }
        if (requester.type !== enumUserTypes.ADMIN && (rootDrive && rootDrive.managerId !== requester.id)) {
            throw new CoreError(
                enumCoreErrors.NO_PERMISSION_ERROR,
                'No permission to get drives.'
            );
        }

        const availableDrives = await this.db.collections.drives_collection.aggregate<{ managerId: string, drives: IDrive[] }>([
            {
                $match: {
                    'life.deletedTime': null,
                    'id': rootId ? new RegExp(`^${rootId}$`) : new RegExp('^.*$'),
                    '$or': [
                        { managerId: requester.id },
                        { 'sharedUsers.iid': requester.id }
                    ]
                }
            },
            {
                $group: {
                    _id: '$managerId',
                    drives: { $push: '$$ROOT' }
                }
            },
            {
                $project: {
                    managerId: '$_id',
                    drives: 1,
                    _id: 0
                }
            }
        ]).toArray();
        // we generate the results as a dict, the key of which is the managerId
        // each value is a list of drives of the associated manager
        const resultObject: Record<string, IDrive[]> = {};
        for (const drives of availableDrives) {
            resultObject[drives['managerId']] = [];
            for (const drive of drives['drives']) {
                // filtered the permission objects
                if (requester.type !== enumUserTypes.ADMIN && drive.managerId !== requester.id) {
                    drive.sharedUsers = drive.sharedUsers.filter((el: { iid: string; }) => el.iid === requester.id);
                }
                resultObject[drives.managerId].push(drive);
            }
            if (drives.drives.filter(el => el.parent === null).length === 0) {
                const rootDrive: IDrive = {
                    id: `shared_by_${drives.managerId}`,
                    managerId: drives.managerId,
                    restricted: false,
                    path: [`shared_by_${drives.managerId}`],
                    name: 'Shared',
                    fileId: null,
                    type: enumDriveNodeTypes.FOLDER,
                    parent: null,
                    children: [],
                    sharedUsers: [{
                        iid: requester.id,
                        read: true,
                        write: false,
                        delete: false
                    }],
                    life: {
                        createdTime: Date.now(),
                        createdUser: drives.managerId,
                        deletedTime: null,
                        deletedUser: null
                    },
                    metadata: {
                    }
                };
                const existingIds = drives.drives.map(el => el.id);
                for (const drive of resultObject[drives.managerId]) {
                    if (!drive.parent || !existingIds.includes(drive.parent)) {
                        drive.parent = rootDrive.id;
                        rootDrive.children.push(drive.id);
                    }
                }
                resultObject[drives.managerId].push(rootDrive);
            }
        }
        return resultObject;
    }

    /**
     * Edit a drive node. Note this could be used for moving a drive node to another parent.
     *
     * @param requester - The requester.
     * @param driveId - The id of the driver.
     * @param managerId - The id of the manager.
     * @param name - The name of the drive.
     * @param description - The description of the drive.
     * @param parentId - The id of the parent node.
     * @param children - The ids of the childeren.
     * @param sharedUsers - Shared users.
     * @param sharedGroups - Shared user groups.
     *
     * @return driveIds - The list of drive ids influenced.
     */
    public async editDrive(requester: IUserWithoutToken | undefined, driveId: string, managerId?: string, name?: string, description?: string, parentId?: string, children?: string[], sharedUsers?: IDrivePermission[]) {
        if (!requester) {
            throw new CoreError(
                enumCoreErrors.NOT_LOGGED_IN,
                enumCoreErrors.NOT_LOGGED_IN
            );
        }

        const drive = await this.db.collections.drives_collection.findOne({ 'id': driveId, 'life.deletedTime': null });
        if (!drive) {
            throw new CoreError(
                enumCoreErrors.NO_PERMISSION_ERROR,
                enumCoreErrors.NO_PERMISSION_ERROR
            );
        }

        if (requester.type !== enumUserTypes.ADMIN && drive.managerId !== requester.id) {
            throw new CoreError(
                enumCoreErrors.NO_PERMISSION_ERROR,
                enumCoreErrors.NO_PERMISSION_ERROR
            );
        }

        const setObj: UpdateFilter<IDrive> = {};

        if (managerId) {
            const manager = await this.db.collections.users_collection.findOne({ 'id': managerId, 'life.deletedTime': null });
            if (!manager) {
                throw new CoreError(
                    enumCoreErrors.CLIENT_MALFORMED_INPUT,
                    'Manager does not exist.'
                );
            }
            setObj['managerId'] = manager;
        }

        if (name) {
            const siblingNames = (await this.db.collections.drives_collection.find({ 'parent': drive.parent, 'life.deletedTime': null }).toArray()).map(el => el.name);
            if (siblingNames.includes(name)) {
                throw new CoreError(
                    enumCoreErrors.CLIENT_MALFORMED_INPUT,
                    'Name already exists.'
                );
            }
            setObj['name'] = name;
        }

        if (description) {
            setObj['description'] = description;
        }

        if (parentId) {
            const parentNode = await this.db.collections.drives_collection.findOne({ 'id': parentId, 'life.deletedTime': null });
            if (!parentNode) {
                throw new CoreError(
                    enumCoreErrors.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY,
                    'Parent does not exist.'
                );
            }
            setObj['parent'] = parentId;
        }

        if (children) {
            const childrenDriveIds: string[] = (await this.db.collections.drives_collection.find({ 'life.deletedTime': null }).toArray()).map(el => el.id);
            if (children.some(el => !childrenDriveIds.includes(el))) {
                throw new CoreError(
                    enumCoreErrors.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY,
                    'Children do not exist.'
                );
            }
            setObj['childeren'] = children;
        }

        if (sharedUsers) {
            const userIds: string[] = (await this.db.collections.users_collection.find({ 'life.deletedTime': null }).toArray()).map(el => el.id);
            if (sharedUsers.map(el => el.iid).some(el => !userIds.includes(el))) {
                throw new CoreError(
                    enumCoreErrors.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY,
                    'Shared users do not exist.'
                );
            }
            setObj['sharedUsers'] = sharedUsers;
        }

        if (Object.keys(setObj).length === 0) {
            throw new CoreError(
                enumCoreErrors.CLIENT_MALFORMED_INPUT,
                'You have to edit at lease one property.'
            );
        }

        // TODO:check sharedUsers and sharedGroups are legal
        const updated = await this.db.collections.drives_collection.findOneAndUpdate({ id: driveId }, {
            $set: setObj
        }, {
            returnDocument: 'after'
        });


        // update children drive parameters
        const driveIds: string[] = [];
        if (sharedUsers || managerId) {
            await this.recursiveFindDrives(drive, [], driveIds);
            const setObjTmp: UpdateFilter<IDrive> = {};
            if (sharedUsers) {
                setObjTmp['sharedUsers'] = sharedUsers;
            }
            if (managerId) {
                setObjTmp['managerId'] = managerId;
            }
            await this.db.collections.drives_collection.updateMany({
                id: { $in: driveIds }
            }, {
                $set: setObjTmp
            });
        } else {
            driveIds.push(driveId);
        }

        // for mv command, edit parent
        if (parentId) {
            const parentNode = await this.db.collections.drives_collection.findOne({ 'id': parentId, 'life.deletedTime': null });
            if (parentNode) {
                await this.db.collections.drives_collection.findOneAndUpdate({ id: parentId }, {
                    $push: {
                        children: driveId
                    }
                });
                // update children path
                for (const childId of driveIds) {
                    const childNode = await this.db.collections.drives_collection.findOne({ id: childId });
                    if (!childNode) {
                        continue;
                    }
                    // update path
                    const path = childNode.path;
                    while (path.length) {
                        if (path[0] !== driveId) {
                            path.shift();
                        }
                        else {
                            break;
                        }
                    }
                    const newPath = parentNode.path.concat(path);
                    await this.db.collections.drives_collection.findOneAndUpdate({ id: childId }, {
                        $set: {
                            path: newPath
                        }
                    });
                }
            }
        }

        if (!updated) {
            throw new CoreError(
                enumCoreErrors.DATABASE_ERROR,
                enumCoreErrors.DATABASE_ERROR
            );
        }
        return {
            driveIds: driveIds,
            drive: updated
        };
    }

    /**
     * Copy a drive to another parent.
     *
     * @param requester
     * @param driveId
     * @param targetParentId
     * @returns
     */
    public async copyDrive(requester: IUserWithoutToken | undefined, driveId: string, targetParentId: string) {
        if (!requester) {
            throw new CoreError(
                enumCoreErrors.NOT_LOGGED_IN,
                enumCoreErrors.NOT_LOGGED_IN
            );
        }

        const driveToCopy = await this.db.collections.drives_collection.findOne({ 'id': driveId, 'life.deletedTime': null });
        if (!driveToCopy || driveToCopy.parent === null || (driveToCopy.managerId !== requester.id && driveToCopy.sharedUsers.filter(el => el.iid === requester.id && el.read === true).length === 0)) {
            throw new CoreError(
                enumCoreErrors.NO_PERMISSION_ERROR,
                enumCoreErrors.NO_PERMISSION_ERROR
            );
        }
        const targetParentDrive = await this.db.collections.drives_collection.findOne({ 'id': targetParentId, 'life.deletedTime': null });
        if (!targetParentDrive || (targetParentDrive.managerId !== requester.id && targetParentDrive.sharedUsers.filter(el => el.iid === requester.id && el.write === true).length === 0)) {
            throw new CoreError(
                enumCoreErrors.NO_PERMISSION_ERROR,
                enumCoreErrors.NO_PERMISSION_ERROR
            );
        }

        // get the drive config for the bucket name
        const userConfig = (await this.db.collections.configs_collection.findOne({ type: enumConfigType.USERCONFIG, key: requester.id }))?.properties ?? defaultSettings.userConfig;

        // update children drive parameters
        const driveIds: string[] = [];
        await this.recursiveFindDrives(driveToCopy, [], driveIds);
        const drives = await this.db.collections.drives_collection.find({ id: { $in: driveIds } }).toArray() ?? [];

        // check the size of the files does not exceed the limit
        const aggregationResult = await this.db.collections.files_collection.aggregate([
            {
                $match: { 'userId': requester.id, 'life.deletedTime': null }
            },
            {
                $group: { _id: '$userId', totalSize: { $sum: '$fileSize' } }
            }
        ]).toArray();
        const totalSize: number = (aggregationResult.length > 0) ? aggregationResult[0]['totalSize'] : 0;
        const userRepoRemainingSpace = (userConfig as IUserConfig).defaultMaximumFileRepoSize - totalSize;
        const defaultFileBucketId = (userConfig as IUserConfig).defaultFileBucketId;

        const fileIds = drives
            .filter(el => (el.type === enumDriveNodeTypes.FILE && el.fileId !== null))
            .map(el => el.fileId)
            .filter((id): id is string => id !== null);  // Filter out null values

        const files = await this.db.collections.files_collection.find({ id: { $in: fileIds } }).toArray();

        const totalFilesSize = files.reduce((acc, el) => acc + el.fileSize, 0);
        if (totalFilesSize > userRepoRemainingSpace) {
            throw new CoreError(
                enumCoreErrors.CLIENT_MALFORMED_INPUT,
                'User repo size exceeded.'
            );
        }

        // List to hold the new drives for database insertion
        const newDrivesForDatabase: IDrive[] = [];

        const idMap: { [oldId: string]: string } = {};
        for (const drive of drives) {
            idMap[drive.id] = uuid();
        }

        for (const drive of drives) {
            if (!drive.parent) {
                continue;
            }
            const newId = idMap[drive.id];
            const newPath = targetParentDrive.path.concat(drive.path.slice(drive.path.indexOf(driveId)).map(el => idMap[el]));
            const newChildren = drive.children.map(childId => idMap[childId]);

            let newFileUri: string | null = null;
            if (drive.fileId !== null) {
                newFileUri = uuid();
                const file = await this.db.collections.files_collection.findOne({ id: drive.fileId });
                if (!file) {
                    continue;
                }
                await this.objectStore.copyObject(defaultFileBucketId, file.uri, defaultFileBucketId, newFileUri);
            }

            const newNode: IDrive = {
                id: newId,
                managerId: requester.id,
                path: newPath,
                restricted: false,
                name: drive.name,
                description: drive.description,
                fileId: newFileUri,
                type: drive.type,
                parent: idMap[drive.parent] ?? targetParentDrive.id,
                children: newChildren,
                sharedUsers: [],
                life: {
                    createdTime: Date.now(),
                    createdUser: requester.id,
                    deletedTime: null,
                    deletedUser: null
                },
                metadata: drive.metadata
            };

            newDrivesForDatabase.push(newNode);
        }

        await this.db.collections.drives_collection.insertMany(newDrivesForDatabase);

        return makeGenericResponse(driveId, true, undefined, 'Drive copied successfully.');
    }
    /**
     * Delete a file node.
     *
     * @param requester - The id of the requester.
     * @param userId - The id of the user.
     * @param driveNodeId - The id of the file node.
     *
     * @return IDrive - The deleted drive.
     */
    public async deleteDrive(requester: IUserWithoutToken | undefined, driveId: string): Promise<IDrive> {
        if (!requester) {
            throw new CoreError(
                enumCoreErrors.NOT_LOGGED_IN,
                enumCoreErrors.NOT_LOGGED_IN
            );
        }

        const drive = await this.db.collections.drives_collection.findOne({ 'id': driveId, 'life.deletedTime': null });
        if (!drive) {
            throw new CoreError(
                enumCoreErrors.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY,
                'Drive does not exist.'
            );
        }
        if (drive.restricted || drive.parent === null) {
            throw new CoreError(
                enumCoreErrors.NO_PERMISSION_ERROR,
                'You can not delete this drive.'
            );
        }

        const driveIds: string[] = [];
        const driveFileIds: string[] = [];
        await this.recursiveFindDrives(drive, driveFileIds, driveIds);
        // delete metadata in drive collection
        await this.db.collections.drives_collection.updateMany({ id: { $in: driveIds } }, {
            $set: {
                'life.deletedTime': Date.now(),
                'life.deletedUser': requester.id
            }
        });
        // delete metadata in file collection
        await this.db.collections.files_collection.updateMany({ id: { $in: driveFileIds } }, {
            $set: {
                'life.deletedTime': Date.now(),
                'life.deletedUser': requester.id
            }
        });
        await this.db.collections?.files_collection.updateMany({ id: drive.parent ?? '' }, {
            $pull: {
                children: drive.id
            }
        });
        return drive;
    }

    public async recursiveFindDrives(root: IDrive, driveFileIds: string[], driveIds: string[]) {
        /**
         * Recursive find the files and file nodes that are in the same tree.
         *
         * @param root - The root from which to start.
         * @param filesList - The ids of the files that belongs to this root.
         * @param nodesList - The ids of the file nodes that belongs to this root.
         *
         * @return null
         */
        if (!root) {
            return;
        }
        driveIds.push(root.id);
        if (root.type === enumDriveNodeTypes.FILE && root.fileId) {
            driveFileIds.push(root.fileId);
            return;
        }
        if (root.type === enumDriveNodeTypes.FOLDER) {
            for (const child of root.children) {
                const thisDrive = await this.db.collections.drives_collection.findOne({ 'id': child, 'life.deletedTime': null });
                if (!thisDrive) {
                    continue;
                } else {
                    await this.recursiveFindDrives(thisDrive, driveFileIds, driveIds);
                }
            }
        }
        return;
    }

    /**
     * Share a drive to a user via email. Only the manager of the drive can share the drive.
     *
     * @param requester - The requester.
     * @param userEmails - The emails of the users.
     * @param driveId - The id of the drive.
     * @param permissions - The permission object.
     */
    public async shareDriveToUserViaEmail(requester: IUserWithoutToken | undefined, userEmails: string[], driveId: string, permissions: { read: boolean, write: boolean, delete: boolean }) {
        if (!requester) {
            throw new CoreError(
                enumCoreErrors.NOT_LOGGED_IN,
                enumCoreErrors.NOT_LOGGED_IN
            );
        }
        const drive = await this.db.collections.drives_collection.findOne({ 'id': driveId, 'life.deletedTime': null, 'managerId': requester.id });
        if (!drive) {
            throw new CoreError(
                enumCoreErrors.NO_PERMISSION_ERROR,
                'You do not have permission to share this drive.'
            );
        }

        const userIds: IDrivePermission[] = [];
        for (const email of userEmails) {
            const user = await this.db.collections.users_collection.findOne({ 'email': email, 'life.deletedTime': null });
            if (!user) {
                continue;
            }
            userIds.push({
                iid: user.id,
                read: permissions.read,
                write: permissions.write,
                delete: permissions.delete
            });
        }

        // find and update all recursive drives
        const driveIds: string[] = [];
        await this.recursiveFindDrives(drive, [], driveIds);
        for (const driveId of driveIds) {
            const drive = await this.db.collections.drives_collection.findOne({ 'id': driveId, 'life.deletedTime': null });
            if (!drive) {
                continue;
            }
            await this.editDrive(requester, driveId, undefined, undefined, undefined, undefined, undefined, userIds);
        }
        return driveIds;
    }
}

