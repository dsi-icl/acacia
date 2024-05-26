import { fileResolvers } from './fileResolvers';
import { jobResolvers } from './jobResolvers';
import { permissionResolvers } from './permissionResolvers';
import { queryResolvers } from './queryResolvers';
import { studyResolvers } from './studyResolvers';
import { userResolvers } from './userResolvers';
import { organisationResolvers } from './organisationResolvers';
import { pubkeyResolvers } from './pubkeyResolvers';
import { GraphQLError } from 'graphql';
import { logResolvers } from './logResolvers';
import { standardizationResolvers } from './standardizationResolvers';
import { IResolvers } from '@graphql-tools/utils';
import { DMPResolver } from './context';
import { errorCodes } from '@itmat-broker/itmat-cores';

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

const bounceNotLoggedInDecorator = (funcName: string, reducerFunction: DMPResolver): DMPResolver => {
    return (parent, args, context, info) => {
        const uncheckedFunctionWhitelist = ['login', 'rsaSigner', 'keyPairGenwSignature', 'issueAccessToken', 'getOrganisations', 'requestUsernameOrResetPassword', 'resetPassword', 'createUser', 'validateResetPassword'];
        const requester = context.req.user;

        if (!requester && !uncheckedFunctionWhitelist.includes(funcName)) {
            throw new GraphQLError(errorCodes.NOT_LOGGED_IN);
        }

        if (typeof reducerFunction === 'function') {
            return reducerFunction(parent, args, context, info);
        } else {
            throw new Error('Attempted to call a non-callable resolver');
        }
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
                a[each][funcName] = bounceNotLoggedInDecorator(funcName, e[each][funcName]);
            }
        }
    }
    return a;
}, reduceInit);
