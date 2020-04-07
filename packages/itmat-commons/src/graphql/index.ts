import * as appUsers from './appUsers';
export * from './appUsers';

import * as curation from './curation';
export * from './curation';

import * as fields from './fields';
export * from './fields';

import * as files from './files';
export * from './files';

import * as permission from './permission';
export * from './permission';

import * as projects from './projects';
export * from './projects';

import * as query from './query';
export * from './query';

import * as study from './study';
export * from './study';

import * as user from './user';
export * from './user';

import * as subscription from './subscription';
export * from './subscription';

export const GQLRequests = {
    ...subscription,
    ...appUsers,
    ...curation,
    ...fields,
    ...files,
    ...permission,
    ...projects,
    ...query,
    ...study,
    ...user,
    subscription,
    appUsers,
    curation,
    fields,
    files,
    permission,
    projects,
    query,
    study,
    user
};

export default GQLRequests;

