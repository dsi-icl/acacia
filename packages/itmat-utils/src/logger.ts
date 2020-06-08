import chalk from 'chalk';

export class Logger {
    public static log(message: string | Record<string, unknown> | unknown): void {
        if (message instanceof Object) { message = JSON.stringify(message, null, '\t'); }
        console.log(`[${new Date().toUTCString()}] ${message}`);
    }

    public static warn(message: string | Record<string, unknown> | unknown): void {
        if (message instanceof Object) { message = JSON.stringify(message, null, '\t'); }
        console.warn(`[${new Date().toUTCString()}] ${chalk.bold.yellow('WARN!')} ${message}`);
    }

    public static error(message: string | Record<string, unknown> | unknown): void {
        if (message instanceof Object) { message = JSON.stringify(message, null, '\t'); }
        console.error(`[${new Date().toUTCString()}] ${chalk.bold.red('ERROR!')} ${message}`);
    }
}
