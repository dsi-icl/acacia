import chalk from 'chalk';

const colorizer = process !== undefined ? chalk : {
    yellow: (str) => str,
    red: (str) => str,
};

const flatten = (messages: any[]): string => {
    let print = '';
    if (messages !== undefined) {
        print = messages.map((message) => {
            if (message instanceof Error) return message.message;
            if (message instanceof Object) return JSON.stringify(message, null, '\t');
            return message;
        }).join(' ');
    }
    return print;
};

export class Logger {
    public static log(...messages: any[]): void {
    // tslint:disable-next-line: no-console
        console.log(`LOG [${new Date().toUTCString()}] ${flatten(messages)}`);
    }

    public static warn(...messages: any[]): void {
    // tslint:disable-next-line: no-console
        console.warn(colorizer.yellow(`WAR [${new Date().toUTCString()}] ${flatten(messages)}`));
    }

    public static error(...messages: any[]): void {
    // tslint:disable-next-line: no-console
        console.error(colorizer.red`ERR [${new Date().toUTCString()}] ${flatten(messages)}`);
    }
}
