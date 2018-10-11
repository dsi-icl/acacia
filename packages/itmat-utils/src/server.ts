import { Express } from 'express';

export interface IServerConfig {
    server: {
        port: number
    }
}

export abstract class Server<T extends IServerConfig> {
    /* USAGE IN ALL PACKAGES:
    1. extend ServerConfig Interface:
    // interface DerivedServerConfig extends ServerConfig {
    //     database: {
    //         tutu: toto
    //     }
    // }

    2. extends class Server and add implementation for initialise():
    // class DerivedServer extends Server<DerivedServerConfig>  {
    //     //only implement initialise()
    //     intialise() {
    //         doStuffLikeConnectToDatabase
    //         return the router;
    //     }
    // }

    3. just call start() after; done.
    */
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


