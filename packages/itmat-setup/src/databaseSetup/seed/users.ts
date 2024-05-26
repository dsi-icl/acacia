export const seedUsers = [{
    username: 'admin',
    type: 'ADMIN',
    firstname: 'Fadmin',
    lastname: 'Ladmin',
    password: '$2b$04$j0aSK.Dyq7Q9N.r6d0uIaOGrOe7sI4rGUn0JNcaXcPCv.49Otjwpi',
    otpSecret: 'H6BNKKO27DPLCATGEJAZNWQV4LWOTMRA',
    organisation: 'organisation_system',
    email: 'admin@example.com',
    resetPasswordRequests: [],
    description: 'I am an admin user.',
    emailNotificationsActivated: true,
    emailNotificationsStatus: { expiringNotification: false },
    id: 'replaced_at_runtime2',
    expiredAt: 1991134065000,
    life: {
        createdTime: 1591134065000,
        createdUser: 'admin',
        deletedTime: null,
        deletedUser: null
    },
    metadata: {}
},
{
    username: 'standardUser',
    type: 'STANDARD',
    firstname: 'Tai Man',
    lastname: 'Chan',
    password: '$2b$04$j0aSK.Dyq7Q9N.r6d0uIaOGrOe7sI4rGUn0JNcaXcPCv.49Otjwpi',
    otpSecret: 'H6BNKKO27DPLCATGEJAZNWQV4LWOTMRA',
    email: 'standard@example.com',
    resetPasswordRequests: [],
    description: 'I am a standard user.',
    emailNotificationsActivated: true,
    emailNotificationsStatus: { expiringNotification: false },
    organisation: 'organisation_system',
    id: 'replaced_at_runtime1',
    createdAt: 1591134065000,
    expiredAt: 1991134065000,
    life: {
        createdTime: 1591134065000,
        createdUser: 'admin',
        deletedTime: null,
        deletedUser: null
    },
    metadata: {}
}];
