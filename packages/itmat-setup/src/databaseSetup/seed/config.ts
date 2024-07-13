export const seedConfigs = [{
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