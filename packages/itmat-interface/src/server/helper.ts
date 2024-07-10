import { ConfigRouter, DataRouter, DomainRouter, DriveRouter, FileResolvers, GraphQLResolvers, JobResolvers, LogResolvers, LogRouter, OrganisationResolvers, OrganisationRouter, PermissionResolvers, PubkeyResolvers, RoleRouter, StandardizationResolvers, StudyResolvers, StudyRouter, TRPCAggRouter, UserResolvers, UserRouter, tRPCBaseProcedureMilldeware } from '@itmat-broker/itmat-apis';
import { db } from '../database/database';
import { TRPCConfigCore, TRPCDataCore, TRPCDataTransformationCore, TRPCDomainCore, TRPCDriveCore, TRPCFileCore, TRPCLogCore, TRPCOrganisationCore, TRPCPermissionCore, TRPCStandarizationCore, TRPCStudyCore, TRPCUserCore, TRPCUtilsCore } from '@itmat-broker/itmat-cores';
import { objStore } from '../objStore/objStore';
import { mailer } from '../emailer/emailer';
import configManager from '../utils/configManager';
import { CreateNextContextOptions } from '@trpc/server/adapters/next';
import { inferAsyncReturnType, initTRPC } from '@trpc/server';


export class APICalls {
    permissionCore: TRPCPermissionCore;
    fileCore: TRPCFileCore;
    utilsCore: TRPCUtilsCore;
    dataTransformationCore: TRPCDataTransformationCore;
    studyCore: TRPCStudyCore;
    dataCore: TRPCDataCore;
    userCore: TRPCUserCore;
    organisationCore: TRPCOrganisationCore;
    logCore: TRPCLogCore;
    standardizationCore: TRPCStandarizationCore;
    driveCore: TRPCDriveCore;
    configCore: TRPCConfigCore;
    domainCore: TRPCDomainCore;
    constructor() {
        this.permissionCore = new TRPCPermissionCore(db);
        this.fileCore = new TRPCFileCore(db, objStore);
        this.utilsCore = new TRPCUtilsCore();
        this.dataTransformationCore = new TRPCDataTransformationCore(this.utilsCore);
        this.studyCore = new TRPCStudyCore(db, objStore, this.permissionCore, this.fileCore);
        this.dataCore = new TRPCDataCore(db, this.fileCore, this.permissionCore, this.utilsCore, this.dataTransformationCore);
        this.userCore = new TRPCUserCore(db, mailer, configManager, objStore);
        this.organisationCore = new TRPCOrganisationCore(db, this.fileCore);
        this.logCore = new TRPCLogCore(db);
        this.standardizationCore = new TRPCStandarizationCore(db, objStore, this.permissionCore, this.studyCore);
        this.driveCore = new TRPCDriveCore(db, this.fileCore, objStore);
        this.configCore = new TRPCConfigCore(db);
        this.domainCore = new TRPCDomainCore(db, this.fileCore);
    }

    _listOfGraphqlResolvers() {
        return (new GraphQLResolvers(
            new StudyResolvers(db, this.studyCore, this.dataCore, this.permissionCore),
            new UserResolvers(db, this.userCore, this.permissionCore),
            new PermissionResolvers(this.permissionCore),
            new JobResolvers(),
            new FileResolvers(db, this.dataCore),
            new OrganisationResolvers(this.organisationCore),
            new PubkeyResolvers(this.userCore),
            new LogResolvers(this.logCore),
            new StandardizationResolvers(this.standardizationCore)
        ))._resolvers();
    }

    _listOfTRPCRouters() {
        const createtRPCContext = async (opts: CreateNextContextOptions) => {
            return {
                user: opts.req.user,
                req: opts.req,
                res: opts.res
            };
        };

        type Context = inferAsyncReturnType<typeof createtRPCContext>;
        const t = initTRPC.context<Context>().create();
        const baseProcedure = t.procedure.use(async (opts) => {
            return await tRPCBaseProcedureMilldeware(db, opts);
        });
        const router = t.router;
        return (new TRPCAggRouter(
            router,
            new UserRouter(baseProcedure, router, this.userCore),
            new DriveRouter(baseProcedure, router, this.driveCore),
            new StudyRouter(baseProcedure, router, this.studyCore),
            new DataRouter(baseProcedure, router, this.dataCore),
            new RoleRouter(baseProcedure, router, this.permissionCore),
            new ConfigRouter(baseProcedure, router, this.configCore),
            new LogRouter(baseProcedure, router, this.logCore),
            new DomainRouter(baseProcedure, router, this.domainCore),
            new OrganisationRouter(baseProcedure, router, this.organisationCore)
        ))._routers();
    }
}