export class CustomError {
    private readonly error: boolean;
    private readonly stack?: Error;
    private readonly message: string;
    private readonly applicationErrorReferenceCode?: number;

    public constructor(message: string, stack?: Error, applicationErrorReferenceCode?: number) {
        this.error = true;

        if (typeof message === 'string') {
            this.message = message;
        } else {
            this.message = 'undefined';
        }

        if (stack) { this.stack = stack; }

        if (applicationErrorReferenceCode) { this.applicationErrorReferenceCode = applicationErrorReferenceCode; }
    }
}
