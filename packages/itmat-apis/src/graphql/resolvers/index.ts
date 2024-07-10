import { IResolvers } from '@graphql-tools/utils';
import { DMPResolver, DMPResolversMap } from './context';
import { errorCodes } from '@itmat-broker/itmat-cores';
import { StudyResolvers } from './studyResolvers';
import { UserResolvers } from './userResolvers';
import { PermissionResolvers } from './permissionResolvers';
import { JobResolvers } from './jobResolvers';
import { FileResolvers } from './fileResolvers';
import { OrganisationResolvers } from './organisationResolvers';
import { PubkeyResolvers } from './pubkeyResolvers';
import { LogResolvers } from './logResolvers';
import { StandardizationResolvers } from './standardizationResolvers';
import { GraphQLError } from 'graphql';

export class GraphQLResolvers {
    studyResolvers: StudyResolvers;
    userResolvers: UserResolvers;
    permissionResolvers: PermissionResolvers;
    jobResolvers: JobResolvers;
    fileResolvers: FileResolvers;
    organisationResolvers: OrganisationResolvers;
    pubkeyResolvers: PubkeyResolvers;
    logResolvers: LogResolvers;
    standardizationResolvers: StandardizationResolvers;
    modules: DMPResolversMap[];
    constructor(studyResolvers: StudyResolvers, userResolvers: UserResolvers, permissionResolvers: PermissionResolvers, jobResolvers: JobResolvers, fileResolvers: FileResolvers, organisationResolvers: OrganisationResolvers, pubkeyResolvers: PubkeyResolvers, logResolvers: LogResolvers, standardizationResolvers: StandardizationResolvers) {
        this.studyResolvers = studyResolvers;
        this.userResolvers = userResolvers;
        this.permissionResolvers = permissionResolvers;
        this.jobResolvers = jobResolvers;
        this.fileResolvers = fileResolvers;
        this.organisationResolvers = organisationResolvers;
        this.pubkeyResolvers = pubkeyResolvers;
        this.logResolvers = logResolvers;
        this.standardizationResolvers = standardizationResolvers;
        this.modules = [
            this.studyResolvers.getResolvers(),
            this.userResolvers.getResolvers(),
            this.permissionResolvers.getResolvers(),
            this.jobResolvers.getResolvers(),
            this.fileResolvers.getResolvers(),
            this.organisationResolvers.getResolvers(),
            this.pubkeyResolvers.getResolvers(),
            this.logResolvers.getResolvers(),
            this.standardizationResolvers.getResolvers()
        ];
    }

    public bounceNotLoggedInDecorator(funcName: string, reducerFunction: DMPResolver): DMPResolver {
        return (parent, args, context, info) => {
            const uncheckedFunctionWhitelist = ['login', 'rsaSigner', 'keyPairGenwSignature', 'issueAccessToken', 'getOrganisations', 'requestUsernameOrResetPassword', 'resetPassword', 'createUser', 'validateResetPassword', 'whoAmI'];
            const requester = context.req.user;

            if (!requester && !uncheckedFunctionWhitelist.includes(funcName)) {
                throw new GraphQLError(errorCodes.NOT_LOGGED_IN);
            }

            if (typeof reducerFunction === 'function') {
                return reducerFunction(parent, args, context, info);
            } else {
                throw new Error('Attempted to call a non-callable resolver');
            }
        };
    }

    public _resolvers(): IResolvers {
        return this.modules.reduce((a, e) => {
            const types = Object.keys(e);
            for (const each of types) {  // types can be Subscription | Query | Mutation | {{TYPE}}
                if (a[each] === undefined) {  // if a doesnt have types then create a empty obj
                    a[each] = {};
                }
                for (const funcName of Object.keys(e[each])) {
                    if (each === 'Subscription') {
                        a[each][funcName] = e[each][funcName];
                    } else {
                        a[each][funcName] = this.bounceNotLoggedInDecorator(funcName, e[each][funcName]);
                    }
                }
            }
            return a;
        }, {});
    }
}

export * from './context';