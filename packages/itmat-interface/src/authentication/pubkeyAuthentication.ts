import { UserInputError } from 'apollo-server-express';
import { db } from '../database/database';
import { IUser } from '@itmat-broker/itmat-types';


export async function userRetrieval(pubkey: string): Promise<IUser> {
    // retrieve userId associated with the token
    const pubkeyrec = await db.collections!.pubkeys_collection.findOne({ jwtPubkey: pubkey, deleted: null });
    if (pubkeyrec === null || pubkeyrec === undefined) {
        throw new UserInputError('The public-key embedded in the JWT is not valid!');
    }
    if (!pubkeyrec.associatedUserId) {
        throw new UserInputError('The public-key embedded in the JWT is not associated with any user!');
    }

    const associatedUser: IUser | null = await db.collections!.users_collection.findOne({ deleted: null, id: pubkeyrec.associatedUserId }, { projection: { _id: 0 } });
    if (!associatedUser) {
        throw new UserInputError('The user assciated with the public-key embedded in the JWT is not existed or already deleted!');
    }
    return associatedUser;
}
