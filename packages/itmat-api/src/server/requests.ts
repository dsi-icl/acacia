import { Request } from 'express';
import { Models } from 'itmat-utils';

export interface ItmatAPIReq<T> extends Request {
    body: T,
    user?: Models.UserModels.IUserWithoutToken
}

declare global {
    namespace requests {
        interface GetJobsByIdReqBody {  // tslint:disable-line
            id: string
        }

        interface GetJobsByUserReqBody { // tslint:disable-line
            user: string
        }

        interface CancelJobReqBody { // tslint:disable-line
            id: string
        }

        interface CreateUserReqBody { // tslint:disable-line
            username: string,
            password: string,
            type: keyof typeof Models.UserModels.userTypes
        }

        interface LoginReqBody { // tslint:disable-line
            username: string,
            password: string
        }

        interface EditUserReqBody { // tslint:disable-line
            user: string,
            password?: string,
            type?: Models.UserModels.userTypes
        }

        interface LogoutReqBody { // tslint:disable-line
            user: string
        }

        interface DeleteUserReqBody { // tslint:disable-line
            user: string
        }

        interface FileUploadReqBody { // tslint:disable-line
            jobType: string,
            study: string,
            file: Blob,
            field?: string, // xxx-yy.z
            patientId?: string
        }
    }
}
