import { DBType } from '../database/database';
import { CoreError, IUserWithoutToken, enumCoreErrors } from '@itmat-broker/itmat-types';


export async function userRetrieval(db: DBType, pubkey: string): Promise<IUserWithoutToken> {
    // retrieve userId associated with the token
    const pubkeyrec = await db.collections.pubkeys_collection.findOne({ 'jwtPubkey': pubkey, 'life.deletedTime': null });
    if (pubkeyrec === null || pubkeyrec === undefined) {
        throw new CoreError(
            enumCoreErrors.AUTHENTICATION_ERROR,
            'The public-key embedded in the JWT is not valid!'
        );
    }
    if (!pubkeyrec.associatedUserId) {
        throw new CoreError(
            enumCoreErrors.AUTHENTICATION_ERROR,
            'The public-key embedded in the JWT is not associated with any user!'
        );
    }

    const associatedUser: IUserWithoutToken | null = await db.collections.users_collection.findOne({ 'life.deletedTime': null, 'id': pubkeyrec.associatedUserId }, { projection: { _id: 0 } });
    if (!associatedUser) {
        throw new CoreError(
            enumCoreErrors.AUTHENTICATION_ERROR,
            'The user assciated with the public-key embedded in the JWT is not existed or already deleted!'
        );
    }
    delete associatedUser['password'];
    delete associatedUser['otpSecret'];
    return associatedUser;
}
