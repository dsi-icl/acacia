
/*
* Each authenticator must also be associated to a user so that you can generate a list of
* authenticator credential IDs to pass into `generateAuthenticationOptions()`, from which one is
* expected to generate an authentication response.
*/

import type { AuthenticatorDevice as OriginalAuthenticatorDevice} from '@simplewebauthn/types';
import { IUser } from './user';
import { IBase } from './base';

// overwrite the AuthenticatorDevice type in simplewebauthn
export type AuthenticatorDevice = Omit<OriginalAuthenticatorDevice, 'id' | 'name'> & {
    id: string; // the ID of the authenticator credential
    name?: string;  // the name of the authenticator credential
    origin?: string; // the origin of the authenticator credential
};

// include the credential
export interface IWebAuthn extends IBase {
    userId: IUser['id'];
    username: IUser['username'];
    devices: AuthenticatorDevice[];
    challenge: Uint8Array;
    challengeTimestamp: number;
}
