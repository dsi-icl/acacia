import { Request } from 'express';
import { Models } from 'itmat-utils';

export interface ItmatCarrierReq<T> extends Request {
    body: T,
    user: Models.UserModels.IUserWithoutToken
}

declare global {
    namespace requests {

    }
}

