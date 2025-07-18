import { TRPCError } from '@trpc/server';
import { IUserWithoutToken } from '@itmat-broker/itmat-types';

const GUEST_ALLOWED_ROUTERS = [
    'user',
    'webauthn',
    'role'
];
const GUEST_ALLOWED_OPERATIONS = [
    'study.getStudies',
    'data.getStudyData',
    'data.getStudyDataLatest',
    'data.getFiles',
    'data.getFilesLatest',
    'data.getStudyFields',
    'data.getData',
    'data.getDataLatest',
    'data.getStudyFilesLatest',
    'data.getStudyFiles',
    'config.getConfig',
    'domain.getCurrentDomain',
    'domain.getCurrentSubPath',
    'organisation.getOrganisations'

];


// Check if user is guest
function isGuestUser(user: IUserWithoutToken): boolean {
    return user.type === 'GUEST';
}

// The middleware
export const guestProtectionMiddleware = async (opts) => {
    // Skip if no user
    if (!opts.ctx.req?.user) {
        return opts.next();
    }

    // Check if user is a guest
    if (isGuestUser(opts.ctx.req.user)) {
        const routerPath = opts.path.split('.')[0];
        const isAllowedRouter = GUEST_ALLOWED_ROUTERS.includes(routerPath);
        const isAllowedOperation = GUEST_ALLOWED_OPERATIONS.includes(opts.path);

        // Grant access only if it's an allowed operation or router
        if (!isAllowedOperation && !isAllowedRouter) {
            throw new TRPCError({
                code: 'FORBIDDEN',
                message: 'Guest users cannot access this feature'
            });
        }

    }

    return opts.next();
};