import * as appUsers from './appUsers';
import * as curation from './curation';
import * as fields from './fields';
import * as files from './files';
import * as permission from './permission';
import * as projects from './projects';
import * as query from './query';
import * as study from './study';
import * as user from './user';
import * as subscription from './subscription';

export const GQLRequests = { ...subscription, ...appUsers, ...curation, ...fields, ...files, ...permission, ...projects, ...query, ...study, ...user };
