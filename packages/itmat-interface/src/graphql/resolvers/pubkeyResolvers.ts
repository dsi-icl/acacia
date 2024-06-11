import { DMPResolversMap } from './context';
import { db } from '../../database/database';
import { PubkeyCore } from '@itmat-broker/itmat-cores';
import config from '../../utils/configManager';
import { mailer } from '../../emailer/emailer';

const pubkeyCore = Object.freeze(new PubkeyCore(db, mailer, config));

export const pubkeyResolvers: DMPResolversMap = {
    Query: {
        getPubkeys: async (_parent, args: { pubkeyId?: string, associatedUserId?: string }) => {
            return pubkeyCore.getPubkeys(args.pubkeyId, args.associatedUserId);
        }
    },

    Mutation: {
        keyPairGenwSignature: async () => {
            return await pubkeyCore.keyPairGenwSignature();
        },

        rsaSigner: async (_parent, { privateKey, message }: { privateKey: string, message: string }) => {
            return pubkeyCore.rsaSigner(privateKey, message);
        },

        issueAccessToken: async (_parent, { pubkey, signature }: { pubkey: string, signature: string }) => {
            return pubkeyCore.issueAccessToken(pubkey, signature);
        },

        registerPubkey: async (_parent, { pubkey, signature, associatedUserId }: { pubkey: string, signature: string, associatedUserId: string }, context) => {
            return await pubkeyCore.registerPubkey(context.req.user, pubkey, signature, associatedUserId);
        }
    },

    Subscription: {}
};
