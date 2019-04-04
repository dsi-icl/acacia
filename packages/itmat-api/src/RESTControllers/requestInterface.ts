import { Request } from 'express';
import { Models } from 'itmat-utils';

export interface ItmatAPIReq<T> extends Request {
    body: T,
    user?: Models.UserModels.IUserWithoutToken
}