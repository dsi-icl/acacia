import type { ExpressMiddlewareOptions } from '@apollo/server/express4';
import { IResolvers } from '@graphql-tools/utils';

export type DMPContext = Awaited<ReturnType<Awaited<NonNullable<ExpressMiddlewareOptions<{
    req: Express.Request;
    res: Express.Response;
}>['context']>>>>;

export type DMPResolversMap = Record<string, IResolvers<never, DMPContext, never, never>>;

export type DMPResolver = DMPResolversMap[keyof DMPResolversMap][keyof DMPResolversMap[keyof DMPResolversMap]]