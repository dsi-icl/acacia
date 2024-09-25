import jwt from 'jsonwebtoken';
import { userRetrieval } from '@itmat-broker/itmat-cores';
import { db } from '../database/database';

export const tokenAuthentication = async (token: string) => {
    if (token !== '') {
        // get the decoded payload ignoring signature, no symmetric secret or asymmetric key needed
        const decodedPayload = jwt.decode(token);
        // obtain the public-key of the robot user in the JWT payload
        let pubkey;
        if (decodedPayload !== null && typeof decodedPayload === 'object') {
            pubkey = decodedPayload['publicKey'];
        } else {
            return false;
        }

        // verify the JWT
        jwt.verify(token, pubkey, function (error) {
            if (error) {
                return false;
            }
            return true;
        });
        // store the associated user with the JWT to context
        try {
            const associatedUser = await userRetrieval(db, pubkey);
            return associatedUser;
        } catch {
            return false;
        }
    } else {
        return null;
    }
};
