import { IBase } from './base';

export interface IOrganisation extends IBase {
    name: string;
    shortname?: string;
    profile?: string;
}