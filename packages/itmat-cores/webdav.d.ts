import { IUserWithoutToken } from '@itmat-broker/itmat-types';

// Augment the webdav-server module
declare module 'webdav-server' {
    type IUser = IUserWithoutToken;
    namespace v2 {
        type IUser = IUserWithoutToken;
        interface RequestContext {
            user: IUserWithoutToken;
        }

        interface DeleteInfo {
            context: RequestContext;
        }

        interface CreateInfo {
            context: RequestContext;
        }

        interface OpenReadStreamInfo {
            context: RequestContext;
        }

        interface OpenWriteStreamInfo {
            context: RequestContext;
        }

        interface ReadDirInfo {
            context: {
                user: IUserWithoutToken;
                headers: {
                    depth?: number
                }
            };
        }

        interface CopyInfo {
            context: RequestContext;
        }

        interface MoveInfo {
            context: RequestContext;
        }

        abstract class FileSystemSerializer {
            abstract uid(): string;
            abstract serialize(fs: FileSystem, callback: ReturnCallback<unknown>): void;
            abstract unserialize(serializeData: unknown, callback: ReturnCallback<FileSystem>): void;
        }

        abstract class FileSystem {
            constructor(FileSystemSerializer)
            abstract _fastExistCheck(ctx: RequestContext, path: Path, callback: (exists: boolean) => void): Promise<void>;
            abstract _displayName(path: Path, ctx: DisplayNameInfo, callback: ReturnCallback<string>): void;
            abstract _lockManager(path: Path, ctx: LockManagerInfo, callback: ReturnCallback<ILockManager>): void;
            abstract _propertyManager(path: Path, ctx: PropertyManagerInfo, callback: ReturnCallback<IPropertyManager>): void;
            abstract _type(path: Path, ctx: TypeInfo, callback: ReturnCallback<ResourceType>): void;
            abstract _delete(path: Path, ctx: DeleteInfo, callback: SimpleCallback): Promise<void>;
            abstract _create(path: Path, ctx: CreateInfo, callback: SimpleCallback): Promise<void>;
            abstract _openReadStream(path: Path, ctx: OpenReadStreamInfo, callback: ReturnCallback<Readable>): Promise<void>;
            abstract _openWriteStream(path: Path, ctx: OpenWriteStreamInfo, callback: ReturnCallback<Writable>): Promise<void>;
            abstract _readDir(path: Path, ctx: ReadDirInfo, callback: ReturnCallback<string[] | Path[]>): Promise<void>;
            abstract _copy(pathFrom: Path, pathTo: Path, ctx: CopyInfo, callback: ReturnCallback<boolean>): Promise<void>;
            abstract _move(pathFrom: Path, pathTo: Path, ctx: MoveInfo, callback: ReturnCallback<boolean>): Promise<void>;
        }
    }
}