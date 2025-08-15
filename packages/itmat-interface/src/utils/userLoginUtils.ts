import { UserLoginUtils } from '@itmat-broker/itmat-cores';
import { db } from '../database/database';

export const userLoginUtils = Object.freeze(new UserLoginUtils(db));
