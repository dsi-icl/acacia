import { GraphQLError } from 'graphql';
import { ApolloServerErrorCode } from '@apollo/server/errors';
import { db } from '../database/database';
import { IUser } from '@itmat-broker/itmat-types';


export async function userRetrieval(pubkey: string): Promise<IUser> {
    // retrieve userId associated with the token
    const pubkeyrec = await db.collections!.pubkeys_collection.findOne({ jwtPubkey: pubkey, deleted: null });
    if (pubkeyrec === null || pubkeyrec === undefined) {
        throw new GraphQLError('The public-key embedded in the JWT is not valid!', { extensions: { code: ApolloServerErrorCode.BAD_USER_INPUT } });
    }
    if (!pubkeyrec.associatedUserId) {
        throw new GraphQLError('The public-key embedded in the JWT is not associated with any user!', { extensions: { code: ApolloServerErrorCode.BAD_USER_INPUT } });
    }

    const associatedUser: IUser | null = await db.collections!.users_collection.findOne({ deleted: null, id: pubkeyrec.associatedUserId }, { projection: { _id: 0 } });
    if (!associatedUser) {
        throw new GraphQLError('The user assciated with the public-key embedded in the JWT is not existed or already deleted!', { extensions: { code: ApolloServerErrorCode.BAD_USER_INPUT } });
    }
    return associatedUser;
}
