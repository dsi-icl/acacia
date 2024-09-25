import { z } from 'zod';
import { TRPCBaseProcedure, TRPCRouter } from './trpc';
import { WebauthnCore} from '@itmat-broker/itmat-cores';



export class WebAuthnRouter {
    baseProcedure: TRPCBaseProcedure;
    router: TRPCRouter;
    webAuthnCore: WebauthnCore;

    constructor(baseProcedure: TRPCBaseProcedure, router: TRPCRouter, webAuthnCore: WebauthnCore) {
        this.baseProcedure = baseProcedure;
        this.router = router;
        this.webAuthnCore = webAuthnCore;
    }

    _router() {
        return this.router({
            getWebauthn: this.baseProcedure.input(z.object({
                webauthn_ids: z.array(z.string())
            })).query(async ({ input }) => {
                const { webauthn_ids } = input;
                return await this.webAuthnCore.getWebauthn(webauthn_ids);
            }),

            getWebauthnRegisteredDevices: this.baseProcedure.query(async ({ ctx }) => {
                return await this.webAuthnCore.getWebauthnDevices(ctx.req.user);
            }),

            getWebauthnID: this.baseProcedure.query(async ({ ctx }) => {
                return await this.webAuthnCore.getUserWebAuthnID(ctx.req.user);
            }),

            webauthnRegister: this.baseProcedure.mutation(async ({ ctx }) => {
                const {rpID} = await this.webAuthnCore.getCurrentOriginAndRpID(ctx);
                return await this.webAuthnCore.getWebauthnRegistrationOptions(ctx.user, rpID);
            }),

            webauthnRegisterVerify: this.baseProcedure.input(z.object({
                attestationResponse: z.any()
            })).mutation(async ({ input, ctx }) => {
                const {origin, rpID} = await this.webAuthnCore.getCurrentOriginAndRpID(ctx);
                return await this.webAuthnCore.handleRegistrationVerify(ctx.req.user, input.attestationResponse,origin, rpID);
            }),

            webauthnAuthenticate: this.baseProcedure.input(z.object({
                userId: z.string()
            })).mutation(async ({ input, ctx}) => {
                const {rpID} = await this.webAuthnCore.getCurrentOriginAndRpID(ctx);
                return await this.webAuthnCore.getWebauthnAuthenticationOptions(input.userId, rpID);
            }),

            webauthnAuthenticateVerify: this.baseProcedure.input(z.object({
                userId: z.string(),
                assertionResponse: z.any()
            })).mutation(async ({ input, ctx }) => {
                const {origin, rpID} = await this.webAuthnCore.getCurrentOriginAndRpID(ctx);
                return await this.webAuthnCore.handleAuthenticationVerify(input.userId, input.assertionResponse, origin, rpID);
            }),

            deleteWebauthnRegisteredDevices: this.baseProcedure.input(z.object({
                deviceId: z.string()
            })).mutation(async ({ input, ctx }) => {
                return await this.webAuthnCore.deleteWebauthnDevices(ctx.user, input.deviceId);
            }),

            updateWebauthnDeviceName: this.baseProcedure.input(z.object({
                deviceId: z.string(),
                name: z.string()
            })).mutation(async ({ input, ctx }) => {
                return await this.webAuthnCore.updateWebauthnDeviceName(ctx.user, input.deviceId, input.name);
            }),
            webauthnLogin: this.baseProcedure.input(z.object({
                userId: z.string(),
                requestExpiryDate: z.boolean().optional()
            })).mutation(async ({ input, ctx }) => {
                return await this.webAuthnCore.webauthnLogin(ctx.req, input.userId, input.requestExpiryDate);
            })
        });
    }
}