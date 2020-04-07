
import * as Permissions from './permissions';
export * from './permissions';

import * as GraphQL from './graphql';
export * from './graphql';

import * as Models from './models';
export * from './models';
export { Models };

export const Commons = {
    ...Permissions,
    ...GraphQL,
    ...Models,
    Permissions,
    GraphQL,
    Models
};

export default Commons;