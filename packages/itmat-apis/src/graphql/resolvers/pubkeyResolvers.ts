import { DMPResolversMap } from './context';
import { UserCore } from '@itmat-broker/itmat-cores';


export class PubkeyResolvers {
    userCore: UserCore;
    constructor(userCore: UserCore) {
        this.userCore = userCore;
    }

    async getPubkeys(_parent, args: { pubkeyId?: string, associatedUserId?: string }, context) {
        return await this.userCore.getUserKeys(context.req.user, args.associatedUserId ?? '');
    }

    async keyPairGenwSignature() {
        return await this.userCore.keyPairGenwSignature();
    }

    async rsaSigner(_parent, { privateKey, message }: { privateKey: string, message: string }) {
        return this.userCore.rsaSigner(privateKey, message);
    }

    async issueAccessToken(_parent, { pubkey, signature }: { pubkey: string, signature: string }) {
        return this.userCore.issueAccessToken(pubkey, signature);
    }

    async registerPubkey(_parent, { pubkey, signature, associatedUserId }: { pubkey: string, signature: string, associatedUserId: string }, context) {
        return await this.userCore.registerPubkey(context.req.user, pubkey, signature, associatedUserId);
    }

    getResolvers(): DMPResolversMap {
        return {
            Query: {
                getPubkeys: this.getPubkeys.bind(this)
            },
            Mutation: {
                keyPairGenwSignature: this.keyPairGenwSignature.bind(this),
                rsaSigner: this.rsaSigner.bind(this),
                issueAccessToken: this.issueAccessToken.bind(this),
                registerPubkey: this.registerPubkey.bind(this)
            }
        };
    }
}
