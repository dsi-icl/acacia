import { APPLICATION_USER_TYPE } from './study';

export function requestToBeAddedToApplication(username: string, study: string, application: string, type: APPLICATION_USER_TYPE) {
    return ({
        timestamp: parseInt(new Date().valueOf() as any),
        notificationType: 'requestToBeAddedToApplication',
        data: {
            username,
            study,
            application,
            type
        },
        read: false
    });
}