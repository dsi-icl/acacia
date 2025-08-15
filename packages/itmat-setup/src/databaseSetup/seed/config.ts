enum enumInstanceType {
    SMALL = 'small',
    MEDIUM ='medium',
    LARGE = 'large'
}

export const seedConfigs = [{
    id: 'root_admin_user_config_protected',
    type: 'USERCONFIG',
    key: 'replaced_at_runtime2',
    properties: {
        id: 'root_admin_user_config',
        life: {
            createdTime: Date.now(),
            createdUser: 'SYSTEM',
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

        // LXD instances
        defaultLXDflavor: [enumInstanceType.SMALL, enumInstanceType.MEDIUM],
        defaultLXDMaximumInstances: 3, // number
        defaultLXDMaximumInstanceCPUCores: 3 * 8,  // number
        defaultLXDMaximumInstanceDiskSize: 3 * 40 * 1024 * 1024 * 1024,
        defaultLXDMaximumInstanceMemory: 3 * 32  *  1024 * 1024 * 1024,
        // set to 360 hours
        defaultLXDMaximumInstanceLife: 360 * 60 * 60 * 1000
    }
}, {
    id: 'root_standard_user_config_protected',
    type: 'USERCONFIG',
    key: 'replaced_at_runtime1',
    properties: {
        id: 'root_standard_user_config',
        life: {
            createdTime: Date.now(),
            createdUser: 'SYSTEM',
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

        // LXD instances
        defaultLXDflavor: [enumInstanceType.SMALL, enumInstanceType.MEDIUM],
        defaultLXDMaximumInstances: 3, // number
        defaultLXDMaximumInstanceCPUCores: 3 * 8,  // number
        defaultLXDMaximumInstanceDiskSize: 3 * 40 * 1024 * 1024 * 1024,
        defaultLXDMaximumInstanceMemory: 3 * 16  *  1024 * 1024 * 1024,
        // set to 360 hours
        defaultLXDMaximumInstanceLife: 360 * 60 * 60 * 1000
    }
}, {
    id: 'root_system_config_protected',
    type: 'SYSTEMCONFIG',
    key: null,
    properties: {
        id: 'root_system_config',
        life: {
            createdTime: Date.now(),
            createdUser: 'SYSTEM',
            deletedTime: null,
            deletedUser: null
        },
        metadata: {},
        defaultBackgroundColor: '#FFFFFF',
        defaultMaximumFileSize: 1 * 1024 * 1024 * 1024, // 1 GB
        defaultFileBucketId: 'system',
        defaultProfileFileBucketId: 'profile',
        defaultProfileBucketId: 'profile',
        logoLink: null,
        logoSize: ['24px', '24px'],
        archiveAddress: '',
        defaultEventTimeConsumptionBar: [50, 100],
        defaultUserExpireDays: 90,
        defaultLXDFlavor: {
            [enumInstanceType.SMALL]: { cpuLimit: 4, memoryLimit: 16 * 1024 * 1024 * 1024, diskLimit: 20 * 1024 * 1024 * 1024 },
            [enumInstanceType.MEDIUM]: { cpuLimit: 8, memoryLimit: 32 * 1024 * 1024 * 1024, diskLimit: 40 * 1024 * 1024 * 1024 },
            [enumInstanceType.LARGE]: { cpuLimit: 16, memoryLimit: 64 * 1024 * 1024 * 1024, diskLimit: 60 * 1024 * 1024 * 1024 }
        }
    },
    life: {
        createdTime: Date.now(),
        createdUser: 'SYSTEM',
        deletedTime: null,
        deletedUser: null
    },
    metadata: {}
}, {
    id: 'root_doc_config_protected',
    type: 'DOCCONFIG',
    key: null,
    properties: {
        id: 'root_doc_config',
        life: {
            createdTime: Date.now(),
            createdUser: 'SYSTEM',
            deletedTime: null,
            deletedUser: null
        },
        metadata: {},
        defaultFileBucketId: 'doc',
        defaultMaximumFileSize: 100 * 1024 * 1024 // 100 MB
    },
    life: {
        createdTime: Date.now(),
        createdUser: 'SYSTEM',
        deletedTime: null,
        deletedUser: null
    },
    metadata: {}
}, {
    id: 'root_cache_config_protected',
    type: 'CACHECONFIG',
    key: null,
    properties: {
        id: 'root_cache_config',
        life: {
            createdTime: Date.now(),
            createdUser: 'SYSTEM',
            deletedTime: null,
            deletedUser: null
        },
        metadata: {},
        defaultFileBucketId: 'cache',
        defaultMaximumFileSize: 100 * 1024 * 1024 // 100 MB
    },
    life: {
        createdTime: Date.now(),
        createdUser: 'SYSTEM',
        deletedTime: null,
        deletedUser: null
    },
    metadata: {}
}, {
    id: 'root_domain_config_protected',
    type: 'DOMAINCONFIG',
    key: null,
    properties: {
        id: 'root_domain_config',
        life: {
            createdTime: Date.now(),
            createdUser: 'SYSTEM',
            deletedTime: null,
            deletedUser: null
        },
        metadata: {},
        defaultFileBucketId: 'domain'
    },
    life: {
        createdTime: Date.now(),
        createdUser: 'SYSTEM',
        deletedTime: null,
        deletedUser: null
    },
    metadata: {}
}];