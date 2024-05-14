import nodemailer, { SendMailOptions } from 'nodemailer';
import appConfig from '../utils/configManager';

class Mailer {
    private readonly _client: nodemailer.Transporter;

    constructor(config: Parameters<typeof nodemailer.createTransport>[0]) {
        this._client = nodemailer.createTransport(config);
    }

    public async sendMail(mail: SendMailOptions): Promise<void> {
        await this._client.sendMail(mail);
    }
}

export const mailer = new Mailer(appConfig.nodemailer);
