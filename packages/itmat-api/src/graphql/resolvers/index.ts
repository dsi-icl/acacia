import { studyResolvers } from './studyResolvers';
import { userResolvers } from './userResolvers';
// import { queryResolvers } from './queryResolvers';
import GraphQLJSON from 'graphql-type-json';

const modules = [
    studyResolvers,
    userResolvers,
    // queryResolvers
];

export const resolvers = {
    JSON: GraphQLJSON,
    Query: modules.reduce((a, e) => { a = { ...a, ...e.Query }; return a; }, {}),
    Mutation: modules.reduce((a, e) => { a = { ...a, ...e.Mutation }; return a; }, {})
};