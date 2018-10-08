import { Request } from 'express';
import { userTypes } from 'itmat-utils';
import { UserWithoutToken } from '../utils/userUtils';

export interface ItmatCarrierReq<T> extends Request {
    body: T,
    user: UserWithoutToken
}

declare global {
    namespace requests {

    }
}

