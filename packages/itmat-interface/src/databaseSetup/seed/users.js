const users = [{
    username: 'admin',
    type: 'ADMIN',
    realName: 'admin',
    password: '$2b$04$j0aSK.Dyq7Q9N.r6d0uIaOGrOe7sI4rGUn0JNcaXcPCv.49Otjwpi',
    otpSecret: 'H6BNKKO27DPLCATGEJAZNWQV4LWOTMRA',
    createdBy: 'chon',
    organisation: 'DSI',
    email: 'admin@example.com',
    resetPasswordRequests: [],
    description: 'I am an admin user.',
    emailNotificationsActivated: false,
    deleted: null,
    id: 'replaced_at_runtime2',
    createdAt: 1591134065000,
    expiredAt: 1991134065000
},
{
    username: 'standardUser',
    type: 'STANDARD',
    realName: 'Chan Tai Man',
    password: '$2b$04$j0aSK.Dyq7Q9N.r6d0uIaOGrOe7sI4rGUn0JNcaXcPCv.49Otjwpi',
    otpSecret: 'H6BNKKO27DPLCATGEJAZNWQV4LWOTMRA',
    createdBy: 'admin',
    email: 'standard@example.com',
    resetPasswordRequests: [],
    description: 'I am a standard user.',
    emailNotificationsActivated: true,
    organisation: 'DSI',
    deleted: null,
    id: 'replaced_at_runtime1',
    createdAt: 1591134065000,
    expiredAt: 1991134065000
}];

module.exports = users;
