import { UKBCoding } from './UKBCoding';
import { UKBFields } from './UKBFields';

export interface DataEntry {
    patientId: string,
    field: string,
    value: string | number
    [propName: string]: string | number;
}

export class UKBData {
    public static async addDataEntry() {

    }
}