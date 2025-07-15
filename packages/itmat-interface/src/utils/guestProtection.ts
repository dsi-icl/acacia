import { TRPCError } from '@trpc/server';
import { IUserWithoutToken } from '@itmat-broker/itmat-types';

// Simple list of operations guests cannot do
const GUEST_BLOCKED_OPERATIONS = [
    'drive.createDriveFolder',
    'drive.createDriveFile',
    'drive.createRecursiveDrives',
    'drive.getDrives',
    'drive.editDrive',
    'drive.shareDriveToUserViaEmail',
    'drive.deleteDrive',
    'drive.copyDrive',
    'instance.createInstance',
    'instance.startStopInstance',
    'instance.restartInstance',
    'instance.editInstance',
    'instance.deleteInstance',
    'instance.getInstances',
    'instance.getQuotaAndFlavors',
    'data.createStudyField',
    'data.editStudyField',
    'data.deleteStudyField',
    'data.uploadStudyData',
    'data.deleteStudyData',
    'data.uploadStudyFileData',
    'data.deleteFile',
    'role.createStudyRole',
    'role.editStudyRole',
    'role.deleteStudyRole',
    'study.createStudy',
    'study.editStudy',
    'study.editStudyVisibility',
    'study.deleteStudy',
    'study.createDataVersion',
    'study.setDataversionAsCurrent'
];

// Check if user is guest
function isGuestUser(user: IUserWithoutToken): boolean {
    return user.type === 'GUEST';
}

// The middleware
export const guestProtectionMiddleware = async (opts: { ctx: any; next: any; path: string }) => {
    const { ctx, next, path } = opts;
    const { user } = ctx;

    // Skip if no user
    if (!user) {
        return next();
    }

    // Check if guest trying to access blocked operation
    if (isGuestUser(user) && GUEST_BLOCKED_OPERATIONS.includes(path)) {
        throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Guest users cannot access this feature'
        });
    }

    return next();
};