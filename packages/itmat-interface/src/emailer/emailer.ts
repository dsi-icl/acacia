import nodemailer from 'nodemailer';
import appConfig from '../utils/configManager';
import { Attachment } from 'nodemailer/lib/mailer';

export interface IMail {
    from: string,
    to: string,
    subject: string,
    html: string,
    attachments?: Attachment[];
}

class Mailer {
    private readonly _client: nodemailer.Transporter;

    constructor(config: any) {
        this._client = nodemailer.createTransport(config);
    }

    public async sendMail(mail: IMail): Promise<void> {
        await this._client.sendMail(mail);
    }
}

export const mailer = new Mailer(appConfig.nodemailer);
