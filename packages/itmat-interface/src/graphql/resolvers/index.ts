import { studyResolvers } from './studyResolvers';
import { userResolvers } from './userResolvers';
import { queryResolvers } from './queryResolvers';
import { permissionResolvers } from './permissionResolvers';
import { jobResolvers } from './jobResolvers';
import { fileResolvers } from './fileResolvers';
import GraphQLJSON from 'graphql-type-json';

const modules = [
    studyResolvers,
    userResolvers,
    queryResolvers,
    permissionResolvers,
    jobResolvers,
    fileResolvers
];

const loggingDecorator = (reducerFunction: Function) => {
    return async (parent: any, args: any, context: any, info: any) => {
        console.log(reducerFunction.name, args, context.req.user && context.req.user.id);
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
            (e as any)[each][funcName] = loggingDecorator((e as any)[each][funcName]);
        }
        a[each] = { ...a[each], ...(e as any)[each] };
    }
    return a;
}, reduceInit);