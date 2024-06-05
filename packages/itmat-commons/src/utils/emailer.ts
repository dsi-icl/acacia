import nodemailer, { SendMailOptions } from 'nodemailer';

export class Mailer {
    private readonly _client: nodemailer.Transporter;

    constructor(config: Parameters<typeof nodemailer.createTransport>[0]) {
        this._client = nodemailer.createTransport(config);
    }

    public async sendMail(mail: SendMailOptions): Promise<void> {
        await this._client.sendMail(mail);
    }
}
