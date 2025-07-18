import { ConfigRouter, DataRouter, DomainRouter, DriveRouter, FileResolvers, GraphQLResolvers, JobResolvers, LogResolvers, LogRouter, OrganisationResolvers, OrganisationRouter, PermissionResolvers, PubkeyResolvers, RoleRouter, StandardizationResolvers, StudyResolvers, StudyRouter, TRPCAggRouter, UserResolvers, UserRouter, tRPCBaseProcedureMilldeware, WebAuthnRouter, InstanceRouter, LXDRouter } from '@itmat-broker/itmat-apis';
import { db } from '../database/database';
import { ConfigCore, DataCore, DataTransformationCore, DomainCore, DriveCore, FileCore, LogCore, OrganisationCore, PermissionCore, StandarizationCore, StudyCore, UserCore, UtilsCore, WebauthnCore, JobCore, InstanceCore, LxdManager } from '@itmat-broker/itmat-cores';
import { objStore } from '../objStore/objStore';
import { mailer } from '../emailer/emailer';
import configManager from '../utils/configManager';
import { CreateNextContextOptions } from '@trpc/server/adapters/next';
import { inferAsyncReturnType, initTRPC } from '@trpc/server';
import { guestProtectionMiddleware } from '../utils/guestProtection';
export class APICalls {
    permissionCore: PermissionCore;
    fileCore: FileCore;
    utilsCore: UtilsCore;
    dataTransformationCore: DataTransformationCore;
    studyCore: StudyCore;
    dataCore: DataCore;
    userCore: UserCore;
    organisationCore: OrganisationCore;
    logCore: LogCore;
    standardizationCore: StandarizationCore;
    driveCore: DriveCore;
    configCore: ConfigCore;
    domainCore: DomainCore;
    webauthnCore: WebauthnCore;
    jobCore: JobCore;
    instanceCore: InstanceCore;
    lxdManager: LxdManager;
    constructor() {
        this.permissionCore = new PermissionCore(db);
        this.fileCore = new FileCore(db, objStore);
        this.utilsCore = new UtilsCore();
        this.dataTransformationCore = new DataTransformationCore(this.utilsCore);
        this.studyCore = new StudyCore(db, objStore, this.permissionCore, this.fileCore);
        this.dataCore = new DataCore(db, objStore, this.fileCore, this.permissionCore, this.utilsCore, this.dataTransformationCore);
        this.userCore = new UserCore(db, mailer, configManager, objStore);
        this.organisationCore = new OrganisationCore(db, this.fileCore);
        this.logCore = new LogCore(db);
        this.standardizationCore = new StandarizationCore(db, objStore, this.permissionCore, this.studyCore);
        this.driveCore = new DriveCore(db, this.fileCore, objStore);
        this.configCore = new ConfigCore(db);
        this.domainCore = new DomainCore(db, this.fileCore);
        this.webauthnCore = new WebauthnCore(db, mailer, configManager, objStore);
        this.jobCore = new JobCore(db);
        this.instanceCore = new InstanceCore(db, mailer, configManager, this.jobCore, this.userCore);
        this.lxdManager = new LxdManager(configManager);
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
        const __unusedCreatetRPCContext = async (opts: CreateNextContextOptions) => {
            return {
                user: opts.req.user,
                req: opts.req,
                res: opts.res
            };
        };

        type Context = inferAsyncReturnType<typeof __unusedCreatetRPCContext>;
        const t = initTRPC.context<Context>().create();
        const protectedProcedure = t.procedure.use(async (opts) => {
            return await guestProtectionMiddleware(opts);
        });
        const baseProcedure = protectedProcedure.use(async (opts) => {
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
            new OrganisationRouter(baseProcedure, router, this.organisationCore),
            new WebAuthnRouter(baseProcedure, router, this.webauthnCore),
            new InstanceRouter(baseProcedure, router, this.instanceCore),
            new LXDRouter(baseProcedure, router, this.lxdManager)
        ))._routers();
    }
}