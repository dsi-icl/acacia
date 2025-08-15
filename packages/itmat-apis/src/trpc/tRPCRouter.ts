import { ConfigRouter } from './configProcedure';
import { DataRouter } from './dataProcedure';
import { DomainRouter } from './domainProcedure';
import { DriveRouter } from './driveProcedure';
import { LogRouter } from './logProcedure';
import { OrganisationRouter } from './organisationProcedure';
import { RoleRouter } from './roleProcedure';
import { StudyRouter } from './studyProcedure';
import { TRPCRouter } from './trpc';
import { UserRouter } from './userProcedure';
import { WebAuthnRouter } from './webauthnProcedure';
import { InstanceRouter } from './instanceProcedure';
import { LXDRouter } from './lxdProcedure';


export class TRPCAggRouter {
    router: TRPCRouter;
    userRouter: UserRouter;
    driveRouter: DriveRouter;
    studyRouter: StudyRouter;
    dataRouter: DataRouter;
    roleRouter: RoleRouter;
    configRouter: ConfigRouter;
    logRouter: LogRouter;
    domainRouter: DomainRouter;
    organisationRouter: OrganisationRouter;
    webAuthnRouter: WebAuthnRouter;
    instanceRouter: InstanceRouter;
    lxdRouter: LXDRouter;

    constructor(router: TRPCRouter, userRouter: UserRouter, driveRouter: DriveRouter, studyRouter: StudyRouter, dataRouter: DataRouter, roleRouter: RoleRouter, configRouter: ConfigRouter, logRouter: LogRouter, domainRouter: DomainRouter, organisationRouter: OrganisationRouter, webAuthnRouter: WebAuthnRouter, instanceRouter: InstanceRouter, lxdRouter: LXDRouter) {
        this.router = router;
        this.userRouter = userRouter;
        this.driveRouter = driveRouter;
        this.studyRouter = studyRouter;
        this.dataRouter = dataRouter;
        this.roleRouter = roleRouter;
        this.configRouter = configRouter;
        this.logRouter = logRouter;
        this.domainRouter = domainRouter;
        this.organisationRouter = organisationRouter;
        this.webAuthnRouter = webAuthnRouter;
        this.instanceRouter = instanceRouter;
        this.lxdRouter = lxdRouter;
    }

    _routers() {
        return this.router({
            user: this.userRouter._router(),
            drive: this.driveRouter._router(),
            study: this.studyRouter._router(),
            data: this.dataRouter._router(),
            role: this.roleRouter._router(),
            config: this.configRouter._router(),
            log: this.logRouter._router(),
            domain: this.domainRouter._router(),
            organisation: this.organisationRouter._router(),
            webauthn: this.webAuthnRouter._router(),
            instance: this.instanceRouter._router(),
            lxd: this.lxdRouter._router()
        });
    }
}


export type APPTRPCRouter = ReturnType<TRPCAggRouter['_routers']>;