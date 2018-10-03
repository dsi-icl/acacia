import express from 'express';

export interface ItmatAPIReq<T> extends express.Request {
    body: T
}


declare global {
    namespace requests {
        interface GetJobsByIdReqBody {
            id: string
        }

        interface GetJobsByUserReqBody {
            user: string
        }

        interface LoginReqBody {
            username: string,
            password: string
        }

        interface LogoutReqBody {
            username: string
        }
    }
}

