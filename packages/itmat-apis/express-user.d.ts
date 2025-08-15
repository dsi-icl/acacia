import type { IUserWithoutToken } from '@itmat-broker/itmat-types';

declare global {

    namespace Express {

        // eslint-disable-next-line @typescript-eslint/no-empty-interface, @typescript-eslint/no-empty-object-type
        interface User extends IUserWithoutToken { }

        interface Request {
            user?: User;
            headers: IncomingHttpHeaders;
            login(user: User, done: (err: unknown) => void): void;
            logout(done: (err: unknown) => void): void;
        }
    }
}