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
        defaultLXDMaximumContainers: 2,
        defaultLXDMaximumContainerCPUCores: 2,
        defaultLXDMaximumContainerDiskSize: 50 * 1024 * 1024 * 1024,
        defaultLXDMaximumContainerMemory: 8 * 1024 * 1024 * 1024,
        defaultLXDMaximumContainerLife: 8 * 60 * 60
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
        defaultLXDMaximumContainers: 2,
        defaultLXDMaximumContainerCPUCores: 2,
        defaultLXDMaximumContainerDiskSize: 50 * 1024 * 1024 * 1024,
        defaultLXDMaximumContainerMemory: 8 * 1024 * 1024 * 1024,
        defaultLXDMaximumContainerLife: 8 * 60 * 60
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
        defaultUserExpireDays: 90
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