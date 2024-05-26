import jwt from 'jsonwebtoken';
import { GraphQLError } from 'graphql';
import { ApolloServerErrorCode } from '@apollo/server/errors';
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
            throw new GraphQLError('JWT verification failed. ', { extensions: { code: ApolloServerErrorCode.BAD_USER_INPUT } });
        }

        // verify the JWT
        jwt.verify(token, pubkey, function (error) {
            if (error) {
                throw new GraphQLError('JWT verification failed. ' + error, { extensions: { code: ApolloServerErrorCode.BAD_USER_INPUT, error } });
            }
        });
        // store the associated user with the JWT to context
        const associatedUser = await userRetrieval(db, pubkey);
        return associatedUser;
    } else {
        return null;
    }
};