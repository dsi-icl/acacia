import { IBase, ILifeCircle } from './base';
import { v4 as uuid } from 'uuid';
import { enumReservedUsers } from './user';

export interface IConfig extends IBase {
    type: enumConfigType;
    key: string | null; // studyid for study; userid for user; null for system
    properties: ISystemConfig | IStudyConfig | IUserConfig | IDocConfig | ICacheConfig | IDomainConfig;
}

export enum enumConfigType {
    SYSTEMCONFIG = 'SYSTEMCONFIG',
    STUDYCONFIG = 'STUDYCONFIG',
    USERCONFIG = 'USERCONFIG',
    DOCCONFIG = 'DOCCONFIG',
    CACHECONFIG = 'CACHECONFIG',
    DOMAINCONFIG = 'DOMAINCONFIG'
}

export interface ISystemConfig extends IBase {
    defaultBackgroundColor: string; // hex code
    defaultMaximumFileSize: number;
    defaultFileBucketId: string;
    defaultProfileBucketId: string;
    logoLink: string | null; // TODO: fetch file from database;
    logoSize: string[]; // width * height
    archiveAddress: string;
    defaultEventTimeConsumptionBar: number[];
    defaultUserExpireDays: number;
}

export enum enumStudyBlockColumnValueType {
    STRING = 'STRING',
    TIME = 'TIME'
}

export interface IStudyFileBlock {
    title: string;
    fieldIds: string[];
    defaultFileColumns: Array<{ title: string, property: string, type: enumStudyBlockColumnValueType }>;
    defaultFileColumnsPropertyColor?: string;
}

export interface IStudyConfig extends IBase {
    defaultStudyProfile: string | null;
    defaultMaximumFileSize: number;
    defaultRepresentationForMissingValue: string;
    defaultFileBlocks: IStudyFileBlock[];
    defaultVersioningKeys: string[]; // data clips with same values of such keys will be considered as the same values with different versions
}

export interface IUserConfig extends IBase {
    defaultUserExpiredDays: number
    defaultMaximumFileSize: number;
    defaultMaximumFileRepoSize: number;
    defaultMaximumRepoSize: number;
    defaultFileBucketId: string;
    defaultMaximumQPS: number;

    // LXD containers
    defaultLXDMaximumContainers: number;
    defaultLXDMaximumContainerCPUCores: number;
    defaultLXDMaximumContainerDiskSize: number;
    defaultLXDMaximumContainerMemory: number;
    defaultLXDMaximumContainerLife: number;
}

export interface IOrganisationConfig extends IBase {
    defaultFileBucketId: string;
}

export interface ICacheConfig extends IBase {
    defaultFileBucketId: string;
    defaultMaximumFileSize: number;
}

export interface IDocConfig extends IBase {
    defaultFileBucketId: string;
    defaultMaximumFileSize: number;
}

export interface IDomainConfig extends IBase {
    defaultMaximumFileSize: number
    defaultFileBucketId: string
}
export interface IDefaultSettings extends IBase {
    systemConfig: ISystemConfig;
    studyConfig: IStudyConfig;
    userConfig: IUserConfig;
    docConfig: IDocConfig;
}

// default settings
export class DefaultSettings implements IDefaultSettings {
    public readonly id: string = uuid();
    public readonly life: ILifeCircle = {
        createdTime: Date.now(),
        createdUser: enumReservedUsers.SYSTEM,
        deletedTime: null,
        deletedUser: null
    };
    public readonly metadata: Record<string, unknown> = {};

    public readonly systemConfig: ISystemConfig = {
        id: uuid(),
        life: {
            createdTime: Date.now(),
            createdUser: enumReservedUsers.SYSTEM,
            deletedTime: null,
            deletedUser: null
        },
        metadata: {},
        defaultBackgroundColor: '#FFFFFF',
        defaultMaximumFileSize: 1 * 1024 * 1024 * 1024, // 1 GB
        defaultFileBucketId: 'system',
        defaultProfileBucketId: 'profile',
        logoLink: null,
        logoSize: ['24px', '24px'],
        archiveAddress: '',
        defaultEventTimeConsumptionBar: [50, 100],
        defaultUserExpireDays: 90
    };

    public readonly studyConfig: IStudyConfig = {
        id: uuid(),
        life: {
            createdTime: Date.now(),
            createdUser: enumReservedUsers.SYSTEM,
            deletedTime: null,
            deletedUser: null
        },
        metadata: {},
        defaultStudyProfile: null,
        defaultMaximumFileSize: 8 * 1024 * 1024 * 1024, // 8 GB,
        defaultRepresentationForMissingValue: '99999',
        defaultFileBlocks: [],
        defaultVersioningKeys: []
    };

    public readonly userConfig: IUserConfig = {
        id: uuid(),
        life: {
            createdTime: Date.now(),
            createdUser: enumReservedUsers.SYSTEM,
            deletedTime: null,
            deletedUser: null
        },
        metadata: {},
        defaultUserExpiredDays: 90,
        defaultMaximumFileSize: 100 * 1024 * 1024, // 100 MB
        defaultMaximumFileRepoSize: 500 * 1024 * 1024, // 500 MB
        defaultMaximumRepoSize: 10 * 1024 * 1024 * 1024, // 10GB
        defaultFileBucketId: 'user',
        defaultMaximumQPS: 500,
        defaultLXDMaximumContainers: 2,
        defaultLXDMaximumContainerCPUCores: 2,
        defaultLXDMaximumContainerDiskSize: 50 * 1024 * 1024 * 1024,
        defaultLXDMaximumContainerMemory: 8 * 1024 * 1024 * 1024,
        defaultLXDMaximumContainerLife: 8 * 60 * 60
    };

    public readonly docConfig: IDocConfig = {
        id: uuid(),
        life: {
            createdTime: Date.now(),
            createdUser: enumReservedUsers.SYSTEM,
            deletedTime: null,
            deletedUser: null
        },
        metadata: {},
        defaultFileBucketId: 'doc',
        defaultMaximumFileSize: 100 * 1024 * 1024 // 100 MB
    };

    public readonly organisationConfig: IOrganisationConfig = {
        id: uuid(),
        life: {
            createdTime: Date.now(),
            createdUser: enumReservedUsers.SYSTEM,
            deletedTime: null,
            deletedUser: null
        },
        metadata: {},
        defaultFileBucketId: 'organisation'
    };

    public readonly cacheConfig: ICacheConfig = {
        id: uuid(),
        life: {
            createdTime: Date.now(),
            createdUser: enumReservedUsers.SYSTEM,
            deletedTime: null,
            deletedUser: null
        },
        metadata: {},
        defaultFileBucketId: 'cache',
        defaultMaximumFileSize: 100 * 1024 * 1024 // 100 MB
    };

    public readonly domainConfig: IDomainConfig = {
        id: uuid(),
        life: {
            createdTime: Date.now(),
            createdUser: enumReservedUsers.SYSTEM,
            deletedTime: null,
            deletedUser: null
        },
        metadata: {},
        defaultFileBucketId: 'domain',
        defaultMaximumFileSize: 10 * 1024 * 1024 // 100 MB
    };
}

export const defaultSettings = Object.freeze(new DefaultSettings());
