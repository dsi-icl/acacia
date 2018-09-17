import { Database } from 'itmat-utils';
import { FieldEntry, UKBFields } from './UKBFields';
import { DataEntry } from './UKBData';

interface CodingEntry {
    Coding: number,
    Value: number,
    Meaning: string
}

export class UKBCoding {

    public static async getCodeMeaning(Coding: number, Value: number): Promise<string> {
        return await Database.UKB_coding_collection.findOne({ Coding, Value });
    }

    public static async decodeEntry(dataEntry: DataEntry): Promise<DataEntry> {
        const fieldId: number = parseInt(dataEntry.field.slice(0, dataEntry.field.indexOf('-')));
        const field: FieldEntry = await UKBFields.getFieldInfo(fieldId);
        if (!field.Coding) {
            return dataEntry;
        } else {
            const meaning: string = await this.getCodeMeaning(field.Coding, parseInt(dataEntry.value as string));
            return { ...dataEntry, value: meaning };
        }
    }

    public static async addEntry(CodingEntry: CodingEntry, update?: boolean) {

    }

}