import GraphQLJSON from 'graphql-type-json';
import { fileResolvers } from './fileResolvers';
import { jobResolvers } from './jobResolvers';
import { permissionResolvers } from './permissionResolvers';
import { queryResolvers } from './queryResolvers';
import { studyResolvers } from './studyResolvers';
import { userResolvers } from './userResolvers';
import { ApolloError } from 'apollo-server-core';
import { errorCodes } from '../errors';
import { IUser } from 'itmat-commons';
import { logResolvers } from './logResolvers';

const modules = [
    studyResolvers,
    userResolvers,
    queryResolvers,
    permissionResolvers,
    jobResolvers,
    fileResolvers,
    logResolvers
];

// const loggingDecorator = (reducerFunction: Function) => {
//     return async (parent: any, args: any, context: any, info: any) => {
//         console.log(reducerFunction.name, args, context.req.user && context.req.user.id);
//         return await reducerFunction(parent, args, context, info);
//     };
// };

const bounceNotLoggedInDecorator = (reducerFunction: any) => {
    return async (parent: any, args: any, context: any, info: any) => {
        const uncheckedFunctionWhitelist = ['login', 'whoAmI', 'requestUsernameOrResetPassword', 'resetPassword', 'createUser', 'writeLog'];
        const requester: IUser = context.req.user;
        if (!requester) {
            if (!(uncheckedFunctionWhitelist as any).includes(reducerFunction.name)) {
                throw new ApolloError(errorCodes.NOT_LOGGED_IN);
            }
        }
        return await reducerFunction(parent, args, context, info);
    };
};


const reduceInit: any = { JSON: GraphQLJSON };
export const resolvers = modules.reduce((a, e) => {
    const types = Object.keys(e);
    for (const each of types) {  // types can be Subscription | Query | Mutation | {{TYPE}}
        if (a[each] === undefined) {  // if a doesnt have types then create a empty obj
            a[each] = {};
        }
        for (const funcName of Object.keys((e as any)[each])) {
            if (each === 'Subscription') {
                (a as any)[each][funcName] = (e as any)[each][funcName];
            } else {
                (a as any)[each][funcName] = bounceNotLoggedInDecorator((e as any)[each][funcName]);
            }
        }
    }
    return a;
}, reduceInit);
