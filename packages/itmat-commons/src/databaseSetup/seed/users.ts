import { IUser, userTypes, fileTypes, IFileMongoEntry } from '../../models';

export const seedRootDirs: IFileMongoEntry[] = [
    {
        id: 'adminRoot',
        fileName: 'home',
        fileType: fileTypes.USER_PERSONAL_DIR,
        uploadedBy: 'replaced_at_runtime2',
        isRoot: true,
        childFileIds: [],
        deleted: null
    },
    {
        id: 'userRoot',
        fileName: 'home',
        fileType: fileTypes.USER_PERSONAL_DIR,
        uploadedBy: 'replaced_at_runtime1',
        isRoot: true,
        childFileIds: [],
        deleted: null
    }
];

export const seedUsers: IUser[] = [{ 
    username : 'admin', 
    type : userTypes.ADMIN, 
    realName : 'admin', 
    password : '$2b$04$j0aSK.Dyq7Q9N.r6d0uIaOGrOe7sI4rGUn0JNcaXcPCv.49Otjwpi',
    otpSecret: 'H6BNKKO27DPLCATGEJAZNWQV4LWOTMRA',  
    createdBy : 'chon', 
    organisation:  'DSI',
    email : 'admin@user.io', 
    resetPasswordRequests: [],
    description: 'I am an admin user.',
    emailNotificationsActivated : false, 
    deleted : null, 
    rootDir: 'adminRoot',
    id : 'replaced_at_runtime2', 
    createdAt: 1591134065000,
    expiredAt: 1991134065000
},
{ 
    username : 'standardUser', 
    type : userTypes.STANDARD, 
    realName : 'Chan Tai Man', 
    password : '$2b$04$j0aSK.Dyq7Q9N.r6d0uIaOGrOe7sI4rGUn0JNcaXcPCv.49Otjwpi', 
    otpSecret: 'H6BNKKO27DPLCATGEJAZNWQV4LWOTMRA', 
    createdBy : 'admin', 
    email : 'standard@user.io', 
    resetPasswordRequests: [],
    description: 'I am a standard user.',
    emailNotificationsActivated : true, 
    organisation:  'DSI',
    deleted : null, 
    rootDir: 'userRoot',
    id : 'replaced_at_runtime1',
    createdAt: 1591134065000,
    expiredAt: 1991134065000
}];
