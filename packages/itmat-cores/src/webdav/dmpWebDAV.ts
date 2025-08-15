/* eslint-disable @typescript-eslint/no-explicit-any */
import { v2 as webdav } from 'webdav-server';
import { Readable, Writable } from 'stream';
import nodeFetch from 'node-fetch';
import { IDrive, IUserWithoutToken, enumFileTypes } from '@itmat-broker/itmat-types';
import { FileCore } from '../coreFunc/fileCore';
import { DriveCore } from '../coreFunc/driveCore';
import { DBType } from '../database/database';
import { StudyCore } from '../coreFunc/studyCore';
import { DataCore } from '../coreFunc/dataCore';

class DMPFileSystemSerializer implements webdav.FileSystemSerializer {
    uid(): string {
        return 'DMPFileSystem-1.0'; // Unique identifier with versioning
    }

    serialize(fs: webdav.FileSystem, callback: webdav.ReturnCallback<unknown>): void {
        if (fs instanceof DMPFileSystem) {
            // we won't actually serialize anything.
            callback(undefined, {});
        } else {
            callback(new Error('Invalid file system type'), undefined);
        }
    }

    unserialize(serializedData: unknown, callback: webdav.ReturnCallback<webdav.FileSystem>): void {
        callback(undefined, undefined);
    }
}


export class DMPFileSystem extends webdav.FileSystem {
    router: unknown;
    isCopying: boolean;
    getFileResults: unknown;
    currentStudy: unknown;
    fileCore: FileCore;
    driveCore: DriveCore;
    studyCore: StudyCore;
    dataCore: DataCore;
    db: DBType;
    myDriveDirName: string;
    studyDirName: string;
    sharedDirName: string;

    constructor(db: DBType, fileCore: FileCore, driveCore: DriveCore, studyCore: StudyCore, dataCore: DataCore) {
        super(new DMPFileSystemSerializer());
        this.db = db;
        this.fileCore = fileCore;
        this.driveCore = driveCore;
        this.studyCore = studyCore;
        this.dataCore = dataCore;
        this.isCopying = false;

        // reserved key words
        this.myDriveDirName = 'My Drive';
        this.studyDirName = 'Study';
        this.sharedDirName = 'Shared';
    }

    override async _fastExistCheck(ctx: webdav.RequestContext, path: webdav.Path, callback: (exists: boolean) => void): Promise<void> {
        const pathStr = path.toString();
        const pathArr = pathToArray(pathStr);
        const user = ctx.user as any;

        if (pathStr === '/') {
            callback(true);
            return;
        } else {
            if (pathArr[0] === 'My Drive') {
                if (this.isCopying) {
                    callback(true);
                    return;
                }
                const userFileDir: Record<string, IDrive[]> = await this.driveCore.getDrives(user);
                const ownUserFiles = userFileDir[user.id];
                if (!ownUserFiles) {
                    callback(false);
                    return;
                }
                const allPaths = ownUserFiles.map((el: { path: string[]; }) =>
                    el.path
                        .map((ek: string) => ownUserFiles.filter((es: { id: string; }) => es.id === ek)?.[0]?.name)
                        .filter((name: string | undefined) => name !== undefined)
                );
                callback(isPathIncluded(pathArr, allPaths));
                return;
            } else if (pathArr[0] === 'Shared') {
                if (pathArr.length == 1) {
                    callback(true);
                    return;
                }
                const usersFileDir: Record<string, IDrive[]> = await this.driveCore.getDrives(user);
                // query the database directly as the API call requires authorisation
                const users = await this.db.collections.users_collection.find({ 'life.deletedTime': null }).toArray();

                let allPaths: string[][] = [];
                for (const userId of Object.keys(usersFileDir)) {
                    if (userId === user.id) {
                        continue;
                    }
                    const owner = users.filter((el: { id: string; }) => el.id === userId)[0];
                    const ownUserFiles = usersFileDir[userId].filter(el => el.path);
                    const validFileIds: string[] = ownUserFiles.map(el => el.id);
                    for (const item of ownUserFiles) {
                        item.path = item.path.filter(el => validFileIds.includes(el));
                    }
                    const partialPaths: string[][] = ownUserFiles.map((el: { path: string[]; }) => el.path.map((ek: string) => ownUserFiles.filter(es => es.id === ek)[0].name));
                    partialPaths.forEach((element: string[]) => {
                        element.unshift(owner ? `${owner.firstname} ${owner.lastname}` : 'NA');
                        element.unshift('Shared');
                    });
                    allPaths = [...allPaths, ...partialPaths];
                }
                callback(isPathIncluded(pathArr, allPaths));
                return;
            } else {
                if (pathArr.length === 1 && pathArr[0] === 'Study') {
                    callback(true);
                    return;
                } else {
                    const studies = await this.studyCore.getStudies(user);
                    const study = studies.filter(el => el.name === pathArr[1])[0];
                    if (!study) {
                        callback(false);
                        return;
                    } else {
                        callback(true);
                        return;
                    }
                }
            }
        }
    }

    override _displayName(path: webdav.Path, ctx: webdav.DisplayNameInfo, callback: webdav.ReturnCallback<string>): void {
        callback(undefined, 'Display name');
    }

    override _lockManager(path: webdav.Path, ctx: webdav.LockManagerInfo, callback: webdav.ReturnCallback<webdav.ILockManager>): void {
        callback(undefined, new webdav.LocalLockManager()); // Use local lock manager for simplicity
    }

    override _propertyManager(path: webdav.Path, ctx: webdav.PropertyManagerInfo, callback: webdav.ReturnCallback<webdav.IPropertyManager>): void {
        callback(undefined, new webdav.LocalPropertyManager()); // Use local property manager for simplicity
    }

    override _type(path: webdav.Path, ctx: webdav.TypeInfo, callback: webdav.ReturnCallback<webdav.ResourceType>): void {
        // Determine type based on path (directory if ends with '/', file otherwise)
        const fileExtensionRegex = /\.[^/]+$/;
        const isFile = fileExtensionRegex.test(path.toString());
        callback(undefined, isFile ? webdav.ResourceType.File : webdav.ResourceType.Directory);
    }

    override async _delete(path: webdav.Path, ctx: webdav.DeleteInfo, callback: webdav.SimpleCallback): Promise<void> {
        const user = ctx.context.user as any;
        const pathStr = path.toString();
        const pathArr = pathToArray(pathStr);
        if (pathArr.length <= 1) {
            callback(new Error('You can not edit the root node'));
            return;
        } else if (pathArr[1] === 'Study') {
            callback(new Error('You can not edit study data'));
            return;
        } else {
            const userFileDir: Record<string, IDrive[]> = await this.driveCore.getDrives(user);
            const ownUserFiles: IDrive[] = userFileDir[user.id];
            const node: IDrive = ownUserFiles.filter(el => el.path.length === pathArr.length && el.path.every((part, index) => ownUserFiles.filter(ek => ek.id === part)[0].name === pathArr[index]))[0];
            try {
                await this.driveCore.deleteDrive(user, node.id);
                callback(undefined);
                return;
            } catch {
                callback(new Error('Failed to delete file'));
                return;
            }
        }
    }

    // TODO: upload file
    override async _create(path: webdav.Path, ctx: webdav.CreateInfo, callback: webdav.SimpleCallback): Promise<void> {
        const user = ctx.context.user as any;
        const pathStr = path.toString();
        const pathArr = pathToArray(pathStr);
        const fileExtensionRegex = /\.[^/]+$/;
        const isFile = fileExtensionRegex.test(pathStr);
        if (isFile) {
            this.isCopying = true;
            callback(undefined);
        } else {
            if (pathArr.length <= 1) {
                callback(new Error('You can not edit the root node'));
                return;
            } else if (pathArr[1] === 'Study') {
                callback(new Error('You can not edit study data'));
                return;
            } else {
                const parentPath = pathArr.slice(0, -1);
                const userFileDir: Record<string, IDrive[]> = await this.driveCore.getDrives(user);
                const ownUserFiles: IDrive[] = userFileDir[user.id];
                const parentNode = ownUserFiles.filter(el => el.path.every((part, index) => ownUserFiles.filter(ek => ek.id === part)[0].name === parentPath[index]) && el.path.length === parentPath.length)[0];
                if (!parentNode) {
                    callback(new Error('You need to create the parent folder first'));
                } else {
                    try {
                        await this.driveCore.createDriveFolder(
                            user,
                            pathArr[pathArr.length - 1],
                            parentNode.id,
                            false,
                            undefined
                        );
                        callback(undefined);
                        return;
                    } catch {
                        callback(new Error('Failed to create folder'));
                        return;
                    }
                }
            }
        }
    }

    override async _openReadStream(path: webdav.Path, ctx: webdav.OpenReadStreamInfo, callback: webdav.ReturnCallback<Readable>): Promise<void> {
        const user = ctx.context.user as any;
        const pathStr = path.toString();
        const pathArr = pathToArray(pathStr);
        if (pathArr.length <= 1) {
            callback(new Error('You can not edit the root node'));
        } else {
            if (pathArr[1] === 'Study') {
                callback(new Error('You can not edit study data'));
            } else if (pathArr[0] === this.myDriveDirName) {
                const userFileDir: Record<string, IDrive[]> = await this.driveCore.getDrives(user);
                const ownUserFiles: IDrive[] = userFileDir[user.id];
                const node: IDrive = ownUserFiles.filter(el => el.path.length === pathArr.length && el.path.every((part, index) => ownUserFiles.filter(ek => ek.id === part)[0].name === pathArr[index]))[0];
                const fileUri = `/file/${node.fileId}`;
                try {
                    const response = await nodeFetch(fileUri);
                    if (!response.ok) {
                        throw new Error('Failed to fetch file.');
                    }
                    callback(undefined, response.body as Readable);
                    return;
                } catch {
                    callback(new Error('Failed to fetch file.'));
                    return;
                }
            }
        }
    }

    override async _openWriteStream(path: webdav.Path, ctx: webdav.OpenWriteStreamInfo, callback: webdav.ReturnCallback<Writable>): Promise<void> {
        const user = ctx.context.user as any;
        const pathStr = path.toString();
        const pathArr = pathToArray(pathStr);
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const _this = this;
        const fileBuffer: Uint8Array[] = [];
        if (pathArr.length <= 1) {
            callback(new Error('You can not edit the root node'));
            return;
        } else if (pathArr[1] === 'Study') {
            callback(new Error('You can not edit study data'));
        } else if (pathArr[0] === this.myDriveDirName) {
            const userFileDir: Record<string, IDrive[]> = await this.driveCore.getDrives(user);
            const ownUserFiles: IDrive[] = userFileDir[user.id];
            pathArr.pop();
            const parentNode: IDrive = ownUserFiles.filter(el => el.path.length === pathArr.length && el.path.every((part, index) => ownUserFiles.filter(ek => ek.id === part)[0].name === pathArr[index]))[0];
            if (!parentNode) {
                callback(new Error('Path does not exist.'));
            }
            let isFinalCalled = false;
            const writeableStream = new Writable({
                write(chunk, encoding, callback) {
                    fileBuffer.push(chunk);
                    callback();
                },
                async final(callback) {
                    if (!isFinalCalled) {
                        isFinalCalled = true;
                        await _this.driveCore.createDriveFile(
                            user,
                            parentNode.id,
                            undefined,
                            enumFileTypes.UNKNOWN,
                            {
                                createReadStream: () => Readable.from(Buffer.concat(fileBuffer)),
                                filename: path.fileName(),
                                mimetype: 'application/octet-stream',  // or a more accurate MIME type if known
                                encoding: 'utf-8'
                            }
                        ).then(() => callback(null)).catch((err: Error | null | undefined) => callback(err));
                    }
                }
            });
            if (this.isCopying) {
                this.isCopying = false;
            }
            callback(undefined, writeableStream);
        } else {
            callback(new Error('Path does not exist.'));
            return;
        }
    }

    override async _readDir(path: webdav.Path, ctx: webdav.ReadDirInfo, callback: webdav.ReturnCallback<string[] | webdav.Path[]>): Promise<void> {
        const user = ctx.context.user as any;
        const depth: number = ctx.context.headers.depth ?? 1;
        const pathStr: string = path.toString();


        if (pathStr === '/') {
            callback(undefined, [this.myDriveDirName, this.sharedDirName, this.studyDirName]);
            return;
        } else {
            const pathArr = pathToArray(pathStr);
            if (pathArr[0] === this.myDriveDirName) {
                const userFileDir: Record<string, IDrive[]> = await this.driveCore.getDrives(user);
                const ownUserFiles = userFileDir[user.id];
                callback(undefined, convertToWebDAVPaths(ownUserFiles, depth, pathStr));
                return;
            } else if (pathArr[0] === this.sharedDirName) {
                const usersFileDir: Record<string, IDrive[]> = await this.driveCore.getDrives(user);
                const users = await this.db.collections.users_collection.find({ 'life.deletedTime': null }).toArray();
                if (pathArr.length === 1) {
                    callback(undefined, Object.keys(usersFileDir).filter(el => el !== user.id).map(el => {
                        const user = users.filter((es: { id: string; }) => es.id === el)[0];
                        return user ? `${user.firstname} ${user.lastname}` : 'NA';
                    }));
                    return;
                }
                let allPaths: string[] = [];
                for (const userId of Object.keys(usersFileDir)) {
                    if (userId === user.id) {
                        continue;
                    }
                    const owner = users.filter((el: { id: string; }) => el.id === userId)[0];
                    const ownUserFiles = usersFileDir[userId].filter(el => el.path);
                    const validFileIds: string[] = ownUserFiles.map(el => el.id);
                    for (const item of ownUserFiles) {
                        item.path = item.path.filter(el => validFileIds.includes(el));
                    }
                    const partialPaths: string[] = convertToWebDAVPaths(ownUserFiles, depth, pathStr, [this.sharedDirName, `${owner.firstname} ${owner.lastname}`]);
                    const completePaths: string[] = partialPaths.map((el: string) => `${this.sharedDirName}/${owner.firstname} ${owner.lastname}/${el}`);
                    allPaths = [...allPaths, ...completePaths];
                }
            } else if (pathArr[0] === this.studyDirName) {
                const studies = await this.studyCore.getStudies(user);
                if (pathArr.length === 1) {
                    callback(undefined, studies.map(el => el.name));
                    return;
                } else {
                    const study = studies.filter(el => el.name === pathArr[1])[0];
                    if (!study) {
                        callback(new Error('Path not found.'));
                        return;
                    } else {
                        try {
                            const files = await this.dataCore.getStudyFiles(user, study.id);
                            callback(undefined, files.map(el => el.fileName ?? ''));
                            return;
                        } catch {
                            callback(new Error('Failed to get study files.'));
                            return;
                        }
                    }

                }
            } else {
                callback(new Error('Path not found.'));
                return;
            }
        }
    }

    override async _copy(pathFrom: webdav.Path, pathTo: webdav.Path, ctx: webdav.CopyInfo, callback: webdav.ReturnCallback<boolean>): Promise<void> {
        const user = ctx.context.user as any;
        function findNodeIdFromPath(pathArr: string[], allPathIds: string[][]) {
            const filtered = allPathIds.filter(el => {
                return el.length === pathArr.length && el.every((part, index) => pathArr[index] === part[0]);
            })[0];
            return filtered[filtered.length - 1][1];
        }
        const userFileDir: Record<string, IDrive[]> = await this.driveCore.getDrives(user);
        const ownUserFiles = userFileDir[user.id];
        const allPathsIds: string[][] = ownUserFiles.map((el: { path: string[]; }) => el.path.map((ek: string) => {
            return ownUserFiles.filter(es => es.id === ek)[0].id;
        }));
        const sourceNodeId = findNodeIdFromPath(pathToArray(pathFrom.toString()), allPathsIds);
        const targetNodeId = findNodeIdFromPath(pathToArray(pathTo.toString()).slice(0, -1), allPathsIds);
        try {
            await this.driveCore.copyDrive(
                user,
                sourceNodeId,
                targetNodeId
            );
        } catch {
            callback(new Error('Failed to copy file.'));
            return;
        }
        callback(undefined, true);
    }

    override async _move(pathFrom: webdav.Path, pathTo: webdav.Path, ctx: webdav.MoveInfo, callback: webdav.ReturnCallback<boolean>): Promise<void> {
        const user = ctx.context.user as any;

        // const caller = this.router.createCaller({ user: ctx.context.user });
        function findNodeIdFromPath(pathArr: string[], allPathIds: string[][]) {
            const filtered = allPathIds.filter(el => {
                return el.length === pathArr.length && el.every((part, index) => pathArr[index] === part[0]);
            })[0];
            return filtered[filtered.length - 1][1];
        }
        const userFileDir: Record<string, IDrive[]> = await this.driveCore.getDrives(user);
        const ownUserFiles = userFileDir[user.id];
        const allPathsIds: string[][] = ownUserFiles.map((el: { path: string[]; }) => el.path.map((ek: string) => {
            return ownUserFiles.filter(es => es.id === ek)[0].id;
        }));
        const sourceNodeId = findNodeIdFromPath(pathToArray(pathFrom.toString()), allPathsIds);
        const targetNodeId = findNodeIdFromPath(pathToArray(pathTo.toString()).slice(0, -1), allPathsIds);
        try {
            await this.driveCore.editDrive(
                user,
                sourceNodeId,
                undefined,
                undefined,
                undefined,
                targetNodeId
            );
        } catch {
            callback(new Error('Failed to move file.'));
            return;
        }
        callback(undefined, true);
    }

}
// The DMPWebDAVAuthentication class implementing the above interface
interface HTTPAuthentication {
    askForAuthentication(): { [headerName: string]: string; };
    getUser(ctx: webdav.HTTPRequestContext, callback: (error: Error | null, user?: IUserWithoutToken) => void): void;
}

export class DMPWebDAVAuthentication implements HTTPAuthentication {
    realm: string;
    db: DBType;
    constructor(db: DBType, realm?: string) {
        this.realm = realm ?? 'realm';
        this.db = db;
    }

    askForAuthentication(): { 'WWW-Authenticate': string; } {
        return {
            'WWW-Authenticate': 'Basic realm="' + this.realm + '"'
        };
    }

    getUser(ctx: webdav.HTTPRequestContext, callback: (error: Error | null, user?: IUserWithoutToken) => void): void {
        try {

            const authHeader = ctx.request.headers['authorization'];

            if (authHeader) {
                if (authHeader.startsWith('Basic ')) {
                    const base64Credentials = authHeader.slice(6);

                    // Logic to retrieve the user from the database using username and password
                    // retrival the user according to the user_id
                    const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
                    const [userId] = credentials.split(':'); // Split the credentials into userId and token


                    this.db.collections.users_collection.findOne(
                        { 'life.deletedTime': null, 'id': userId },
                        { projection: { password: 0, otpSecret: 0 } }
                    )
                        .then((user) => {
                            if (!user) {
                                callback(new Error('Invalid credentials'));
                                return;
                            }
                            callback(null, user as IUserWithoutToken); // Pass the user object to the callback
                        })
                        .catch(() => {
                            callback(new Error('Error retrieving user'));
                        });
                } else {
                    callback(new Error('Unsupported authentication method'));
                }
            } else {
                callback(new Error('No authentication provided'));
            }
            // get the user from the request
            // const user = ctx.user as any;
            // if (!user) {
            //     callback(new Error('Invalid credentials'));
            //     return;
            // } else {
            //     callback(null, user);
            //     return;
            // }
            // const token = ctx.headers.find('authorization') ?? '';
            // const decodedPayload = jwt.decode(token);
            // let pubkey: string;
            // if (decodedPayload !== null && !(typeof decodedPayload === 'string')) {
            //     pubkey = decodedPayload['publicKey'];
            // } else {
            //     callback(new Error('JWT verification failed.'));
            //     return;
            // }
            // // verify the JWT
            // jwt.verify(token, pubkey, function (error) {
            //     if (error) {
            //         callback(new Error('JWT verification failed.'));
            //     }
            // });
            // try {
            //     userRetrieval(this.db, pubkey).then((associatedUser) => {
            //         callback(null, associatedUser);
            //     }).catch(() => {
            //         callback(new Error('Invalid credentials'));
            //     });
            // } catch {
            //     callback(new Error('Invalid credentials'));
            // }
        } catch {
            callback(new Error('Invalid credentials'));
        }
    }
}

function pathToArray(path: string) {
    return path.split('/').filter(Boolean);
}

function convertToWebDAVPaths(ownUserFiles: IDrive[], depth: number, pathStr: string, prefix?: string[]): string[] {
    const allPaths = ownUserFiles.map((el: { path: string[]; }) =>
        el.path
            .map((ek: string) => ownUserFiles.filter((es: { id: string; }) => es.id === ek)?.[0]?.name)
            .filter((name: string | undefined) => name !== undefined)
    );
    const basePath = pathToArray(pathStr);
    if (prefix) {
        const result = allPaths.map((el: ConcatArray<string>) => prefix.concat(el));
        return getDirectChildren(result, basePath);
    }
    return getDirectChildren(allPaths, basePath);
}

function getDirectChildren(allPaths: string[][], basePath: string[]): string[] {
    const basePathLength = basePath.length;
    const directChildren = new Set<string>();

    for (const path of allPaths) {
        // Check if the current path is a direct child of the basePath
        if (path.length > basePathLength && basePath.every((part, index) => part === path[index])) {
            directChildren.add(path[basePathLength]);
        }
    }

    return Array.from(directChildren);
}

function isPathIncluded(givenPath: string[], paths: string[][]): boolean {
    return paths.some(path =>
        givenPath.every((part, index) => part === path[index])
    );
}

