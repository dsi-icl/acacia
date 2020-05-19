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
            host: config.host,
            port: config.port,
            secure: config.secure,
            auth: {
                user: config.auth.user,
                pass: config.auth.pass
            }
        });
    }

    public async sendMail(mail: IMail): Promise<void> {
        await this._client.sendMail(mail);
    }
}

export const mailer = new Mailer(appConfig.nodemailer);