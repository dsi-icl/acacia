import { DBType } from '../database/database';
import { CoreError, IUserWithoutToken, enumCoreErrors } from '@itmat-broker/itmat-types';


export async function userRetrieval(db: DBType, pubkey: string, isSystemToken?: boolean, userId?: string): Promise<IUserWithoutToken> {
    if (isSystemToken && userId) {
        // Handle system token - directly fetch user by userId
        const associatedUser: IUserWithoutToken | null = await db.collections.users_collection.findOne(
            { 'life.deletedTime': null, 'id': userId },
            { projection: { password: 0, otpSecret: 0 } }
        );

        if (!associatedUser) {
            throw new CoreError(
                enumCoreErrors.AUTHENTICATION_ERROR,
                'The user associated with the system token does not exist or is deleted!'
            );
        }

        return associatedUser;
    } else {
        // Handle regular token - existing pubkey-based authentication
        const pubkeyrec = await db.collections.pubkeys_collection.findOne({ 'jwtPubkey': pubkey, 'life.deletedTime': null });
        if (!pubkeyrec) {
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

        const associatedUser: IUserWithoutToken | null = await db.collections.users_collection.findOne(
            { 'life.deletedTime': null, 'id': pubkeyrec.associatedUserId },
            { projection: { password: 0, otpSecret: 0 } }
        );

        if (!associatedUser) {
            throw new CoreError(
                enumCoreErrors.AUTHENTICATION_ERROR,
                'The user associated with the public-key does not exist or is deleted!'
            );
        }
        // delete the password and otpSecret from the user object
        delete associatedUser['password'];
        delete associatedUser['otpSecret'];

        return associatedUser;
    }
}

