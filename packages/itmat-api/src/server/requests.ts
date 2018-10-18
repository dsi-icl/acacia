import { Request } from 'express';
import { Models } from 'itmat-utils';

export interface ItmatAPIReq<T> extends Request {
    body: T,
    user: Models.UserModels.IUserWithoutToken
}

declare global {
    namespace requests {
        interface GetJobsByIdReqBody {
            id: string
        }

        interface GetJobsByUserReqBody {
            user: string
        }

        interface CancelJobReqBody {
            id: string
        }

        interface CreateUserReqBody {
            username: string,
            password: string,
            type: keyof typeof Models.UserModels.userTypes
        }

        interface LoginReqBody {
            username: string,
            password: string
        }

        interface EditUserReqBody {
            user: string,
            password?: string,
            type?: Models.UserModels.userTypes
        }

        interface LogoutReqBody {
            user: string
        }

        interface DeleteUserReqBody {
            user: string
        }

        interface FileUploadReqBody {
            file: Blob
        }
    }
}

