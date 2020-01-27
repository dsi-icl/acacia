import chalk from 'chalk';

export class Logger {
    public static log(message: any): void {
        if (message instanceof Object) { message = JSON.stringify(message, null, '\t'); }
        // tslint:disable-next-line: no-console
        console.log(`[${new Date().toUTCString()}] ${message}`);
    }

    public static warn(message: any): void {
        if (message instanceof Object) { message = JSON.stringify(message, null, '\t'); }
        // tslint:disable-next-line: no-console
        console.log(`[${new Date().toUTCString()}] ${chalk.bold.yellow('WARN!')} ${message}`);
    }

    public static error(message: any): void {
        if (message instanceof Object) { message = JSON.stringify(message, null, '\t'); }
        // tslint:disable-next-line: no-console
        console.log(`[${new Date().toUTCString()}] ${chalk.bold.red('ERROR!')} ${message}`);
    }

    // constructor(private readonly identity: string, private readonly logCollection: mongodb.Collection) {
    // }

    // public static audit(user: string, message: any): void {
    //     if (message instanceof Object) { message = JSON.stringify(message, null, '\t'); }
    //     console.log(`[${new Date().toUTCString()}] ${chalk.bold.blue('Audit')} ${message}`);
    // }
}
