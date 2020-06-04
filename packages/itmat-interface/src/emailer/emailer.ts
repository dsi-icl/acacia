import nodemailer from 'nodemailer';
import appConfig, { INodemailerConfig } from '../utils/configManager';

export interface IMail {
    from: string,
    to: string,
    subject: string,
    html: string
}

class Mailer {
    private readonly _client: nodemailer.Transporter;

    constructor(config: INodemailerConfig) {
        this._client = nodemailer.createTransport({
            auth: {
                user: config.auth.user,
                pass: config.auth.pass
            },
            service: config.service
        });
    }

    public async sendMail(mail: IMail): Promise<void> {
        await this._client.sendMail(mail);
    }
}

export const mailer = new Mailer(appConfig.nodemailer);