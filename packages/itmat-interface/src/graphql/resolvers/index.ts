import { fileResolvers } from './fileResolvers';
import { jobResolvers } from './jobResolvers';
import { permissionResolvers } from './permissionResolvers';
import { queryResolvers } from './queryResolvers';
import { studyResolvers } from './studyResolvers';
import { userResolvers } from './userResolvers';
import { organisationResolvers } from './organisationResolvers';
import { pubkeyResolvers } from './pubkeyResolvers';
import { GraphQLError } from 'graphql';
import { errorCodes } from '../errors';
import { logResolvers } from './logResolvers';
import { standardizationResolvers } from './standardizationResolvers';
import { IResolvers } from '@graphql-tools/utils';
import { DMPResolver } from './context';

const modules = [
    studyResolvers,
    userResolvers,
    queryResolvers,
    permissionResolvers,
    jobResolvers,
    fileResolvers,
    organisationResolvers,
    pubkeyResolvers,
    logResolvers,
    standardizationResolvers
];

// const loggingDecorator = (reducerFunction: Function) => {
//     return async (parent, args, context, info) => {
//         return await reducerFunction(parent, args, context, info);
//     };
// };

const bounceNotLoggedInDecorator = (reducerFunction: DMPResolver): DMPResolver => {
    return (parent, args, context, info) => {
        const uncheckedFunctionWhitelist = ['login', 'rsaSigner', 'keyPairGenwSignature', 'issueAccessToken', 'whoAmI', 'getOrganisations', 'requestUsernameOrResetPassword', 'resetPassword', 'createUser', 'writeLog', 'validateResetPassword'];
        const requester = context.req.user;

        if (!requester) {
            if (!uncheckedFunctionWhitelist.includes(reducerFunction.name)) {
                throw new GraphQLError(errorCodes.NOT_LOGGED_IN);
            }
        }
        return reducerFunction(parent, args, context, info);
    };
};


const reduceInit: Record<string, IResolvers> = {};
export const resolvers = modules.reduce((a, e) => {
    const types = Object.keys(e);
    for (const each of types) {  // types can be Subscription | Query | Mutation | {{TYPE}}
        if (a[each] === undefined) {  // if a doesnt have types then create a empty obj
            a[each] = {};
        }
        for (const funcName of Object.keys(e[each])) {
            if (each === 'Subscription') {
                a[each][funcName] = e[each][funcName];
            } else {
                a[each][funcName] = bounceNotLoggedInDecorator(e[each][funcName]);
            }
        }
    }
    return a;
}, reduceInit);
