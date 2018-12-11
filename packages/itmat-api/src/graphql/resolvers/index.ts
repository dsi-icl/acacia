import { studyResolvers } from './studyResolvers';
import { userResolvers } from './userResolvers';

const modules = [
    studyResolvers,
    userResolvers
];

export const resolvers = {
    Query: modules.reduce((a, e) => { a = { ...a, ...e.Query }; return a; }, {}),
    Mutation: modules.reduce((a, e) => { a = { ...a, ...e.Mutation }; return a; }, {})
};