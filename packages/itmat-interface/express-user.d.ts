import type { IUserWithoutToken } from '@itmat-broker/itmat-types';

declare global {

    namespace Express {

        // eslint-disable-next-line @typescript-eslint/no-empty-interface, @typescript-eslint/no-empty-object-type
        interface User extends IUserWithoutToken { }

        interface MulterFile {
            fieldname: string;
            originalname: string;
            encoding: string;
            mimetype: string;
            buffer: Buffer;
            size: number;
        }

        interface Request {
            user?: User;
            files?: MulterFile[];
            headers: IncomingHttpHeaders;
            login(user: User, done: (err: unknown) => void): void;
            logout(done: (err: unknown) => void): void;
        }
    }
}