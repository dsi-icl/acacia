import { Express, Request, Response, NextFunction, RequestHandler } from 'express';
import { CustomError } from './error';
import { APIErrorTypes } from './definitions/errors';
import { userTypes } from './definitions/users';
export abstract class Server<T extends { server: { port: number } }> {
    protected readonly config: T;
    protected readonly port: number;

    constructor(config: T) {
        this.config = config;
        this.port = config.server.port;
    }

    protected abstract initialise(): Promise<Express>;

    public async start(): Promise<void> {
        const app: Express = await this.initialise();

        app.listen(this.port, () => { 
            console.log(`I am listening on port ${this.port}!`); 
        }).on('error', (err) => {
            console.log(`Cannot start server..maybe port ${this.port} is already in use?`, err);
            process.exit(1);
        });
    }
}


interface APIReq<T> extends Request {
    body: T
}

export function checkMustaveKeysInBody<T>(keys: (keyof T)[]): RequestHandler {
    return function middleware(req: APIReq<T>, res: Response, next: NextFunction): void {
        if (!req.body) {
            res.status(400).json(new CustomError(APIErrorTypes.missingRequestKey('body', keys as string[])));
            return;
        }
        for (let each of keys) {
            if ((req.body as any)[each] === undefined) {
                res.status(400).json(new CustomError(APIErrorTypes.missingRequestKey('body', keys as string[])));
                return;
            }
        }
        next();

    }
}

declare global {
    namespace Express {
        interface Request {
            user: any
        }
    }
}

export function bounceNonAdmin(req: Request, res: Response, next: NextFunction): void {
    if (req.user.type !== userTypes.ADMIN) {
        res.status(401).json(new CustomError(APIErrorTypes.authorised));
        return;
    }
    next();
}

export function bounceNonAdminAndNonSelf(req: Request, res: Response, next: NextFunction): void {
    if (req.user.type === userTypes.ADMIN || req.user.username === req.body.username) {
        next();
        return;
    }
    res.status(401).json(new CustomError(APIErrorTypes.authorised));
    return;
}