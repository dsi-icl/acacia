import GraphQLJSON from 'graphql-type-json';
import { fileResolvers } from './fileResolvers';
import { jobResolvers } from './jobResolvers';
import { permissionResolvers } from './permissionResolvers';
import { queryResolvers } from './queryResolvers';
import { studyResolvers } from './studyResolvers';
import { userResolvers } from './userResolvers';
import { ApolloError } from 'apollo-server-core';
import { errorCodes } from '../errors';
import { IUser } from 'itmat-commons/dist/models/user';

const modules = [
    studyResolvers,
    userResolvers,
    queryResolvers,
    permissionResolvers,
    jobResolvers,
    fileResolvers
];

// const loggingDecorator = (reducerFunction: Function) => {
//     return async (parent: any, args: any, context: any, info: any) => {
//         console.log(reducerFunction.name, args, context.req.user && context.req.user.id);
//         return await reducerFunction(parent, args, context, info);
//     };
// };

const bounceNotLoggedInDecorator = (reducerFunction: any) => {
    return async (parent: any, args: any, context: any, info: any) => {
        const uncheckedFunctionWhitelist = ['login', 'whoAmI'];
        const requester: IUser = context.req.user;
        if (!requester) {
            if (!(uncheckedFunctionWhitelist as any).includes(reducerFunction.name)){
                throw new ApolloError(errorCodes.NOT_LOGGED_IN);
            }
        }
        return await reducerFunction(parent, args, context, info);
    };
};


const reduceInit: any = { JSON: GraphQLJSON };
export const resolvers = modules.reduce((a, e) => {
    const types = Object.keys(e);
    for (const each of types) {
        if (a[each] === undefined) {
            a[each] = {};
        }
        for (const funcName of Object.keys((e as any)[each])) {
            if (each === 'Subscription') {
                (e as any)[each][funcName] = (e as any)[each][funcName];
            }
            (e as any)[each][funcName] = bounceNotLoggedInDecorator((e as any)[each][funcName]);
        }
        a[each] = { ...a[each], ...(e as any)[each] };
    }
    return a;
}, reduceInit);