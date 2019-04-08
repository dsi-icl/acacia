import { studyResolvers } from './studyResolvers';
import { userResolvers } from './userResolvers';
import { queryResolvers } from './queryResolvers';
import { fieldResolvers } from './fieldResolvers';
import { permissionResolvers } from './permissionResolvers';
import GraphQLJSON from 'graphql-type-json';

const modules = [
    studyResolvers,
    userResolvers,
    queryResolvers,
    fieldResolvers,
    permissionResolvers
];

export const resolvers = {
    JSON: GraphQLJSON,
    Query: modules.reduce((a, e) => { a = { ...a, ...e.Query }; return a; }, {}),
    Mutation: modules.reduce((a, e) => { a = { ...a, ...e.Mutation }; return a; }, {}),
    Subscription: modules.reduce((a, e) => { a = { ...a, ...e.Subscription }; return a; }, {}),
};