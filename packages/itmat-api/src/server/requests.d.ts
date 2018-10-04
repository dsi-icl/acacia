import { Request } from 'express';
import { userTypes } from 'itmat-utils';
import { UserWithoutToken } from '../utils/userUtils';

export interface ItmatAPIReq<T> extends Request {
    body: T,
    user: UserWithoutToken
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
            type: keyof typeof userTypes
        }

        interface LoginReqBody {
            username: string,
            password: string
        }

        interface LogoutReqBody {
            username: string
        }

        interface DeleteUserReqBody {
            username: string
        }
    }
}

