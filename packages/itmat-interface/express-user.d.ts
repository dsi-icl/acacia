import type { IUserWithoutToken } from '@itmat-broker/itmat-types';

declare global {

    namespace Express {

        // eslint-disable-next-line @typescript-eslint/no-empty-interface
        interface User extends IUserWithoutToken { }

        interface Request {
            user?: User;
            headers: IncomingHttpHeaders
        }
    }
}