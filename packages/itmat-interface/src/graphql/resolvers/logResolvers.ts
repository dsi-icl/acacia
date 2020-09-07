import { db } from '../../database/database';
import { ILogEntry, userTypes, Models } from 'itmat-commons';
import { ApolloError } from 'apollo-server-errors';
import { errorCodes } from '../errors';

export const logResolvers = {
    Query: {
        getLogs: async (__unused_parent: Record<string, unknown>, args: any, context: any): Promise<ILogEntry[]> => {
            const requester: Models.UserModels.IUser = context.req.user;

            /* only admin can access this field */
            if (requester.type !== userTypes.ADMIN) {
                throw new ApolloError(errorCodes.NO_PERMISSION_ERROR);
            }

            const queryObj = {};
            for (const prop in args) {
                if (args.prop !== undefined) {
                    queryObj[prop] = args.prop;
                }
            }
            const cursor = db.collections!.log_collection.find<ILogEntry>(queryObj, { projection: { _id: 0 } }).sort('time', -1);
            return cursor.toArray();
        }
    }
};
