import appConfig from '../utils/configManager';
import { Mailer } from '@itmat-broker/itmat-commons';

export const mailer = new Mailer(appConfig.nodemailer);
