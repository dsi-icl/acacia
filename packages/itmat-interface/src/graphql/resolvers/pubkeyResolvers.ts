import { DMPResolversMap } from './context';
import { db } from '../../database/database';
import { TRPCUserCore } from '@itmat-broker/itmat-cores';
import config from '../../utils/configManager';
import { mailer } from '../../emailer/emailer';
import { objStore } from '../../objStore/objStore';

const userCore = new TRPCUserCore(db, mailer, config, objStore);

export const pubkeyResolvers: DMPResolversMap = {
    Query: {
        getPubkeys: async (_parent, args: { pubkeyId?: string, associatedUserId?: string }, context) => {
            return await userCore.getUserKeys(context.req.user, args.associatedUserId ?? '');
        }
    },

    Mutation: {
        keyPairGenwSignature: async () => {
            return await userCore.keyPairGenwSignature();
        },

        rsaSigner: async (_parent, { privateKey, message }: { privateKey: string, message: string }) => {
            return userCore.rsaSigner(privateKey, message);
        },

        issueAccessToken: async (_parent, { pubkey, signature }: { pubkey: string, signature: string }) => {
            return userCore.issueAccessToken(pubkey, signature);
        },

        registerPubkey: async (_parent, { pubkey, signature, associatedUserId }: { pubkey: string, signature: string, associatedUserId: string }, context) => {
            return await userCore.registerPubkey(context.req.user, pubkey, signature, associatedUserId);
        }
    },

    Subscription: {}
};
