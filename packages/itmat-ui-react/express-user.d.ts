import type { IUserWithoutToken } from '@itmat-broker/itmat-types';

declare global {

    namespace Express {

        type User = IUserWithoutToken

        interface Request {
            user?: User;
            headers: IncomingHttpHeaders;
            login(user: User, done: (err: unknown) => void): void;
            logout(done: (err: unknown) => void): void;
        }
    }
}
